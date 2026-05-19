/**
 * CHITRAS OMS — Frontend API Layer
 * File: js/api.js
 *
 * Provides the OMS_API object used throughout app.jsx.
 * Handles all communication with the Apps Script backend,
 * offline queue management, split caching (config vs suggestions), and utility helpers.
 */

const OMS_API = (() => {

  // ─── INTERNAL STATE ───────────────────────────────────────────────────────

  let _configCache = null;
  let _configCachedAt = 0;

  // ─── CORE FETCH HELPERS ───────────────────────────────────────────────────

  async function get(action, params = {}) {
    const url = new URL(OMS_CONFIG.API_URL);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow'
    });

    const text = await res.text();

    if (text.trim().startsWith('<')) {
      throw new Error('API returned HTML — check deployment URL and access settings');
    }

    return JSON.parse(text);
  }

  async function post(payload) {
    const res = await fetch(OMS_CONFIG.API_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });

    const text = await res.text();

    if (text.trim().startsWith('<')) {
      return { status: 'success', _html_response: true };
    }

    return JSON.parse(text);
  }

  // ─── BOOTSTRAP WITH SPLIT CACHE ───────────────────────────────────────────

  function _sanitizeBootstrap(data) {
    if (!data || data.status !== 'success') return data;
    try {
      if (data.suggestions && Array.isArray(data.suggestions.customers)) {
        data.suggestions.customers = data.suggestions.customers
          .filter(c => c && (c.name != null || c.phone != null))
          .map(c => ({
            name: String(c.name == null ? '' : c.name),
            phone: String(c.phone == null ? '' : c.phone)
          }));
      }
    } catch (e) { /* ignore */ }
    return data;
  }
  async function getBootstrap() {
    const now = Date.now();

    // Check in-memory config cache first (24hr TTL)
    if (_configCache && (now - _configCachedAt) < OMS_CONFIG.CACHE_TTL_CONFIG_MS) {
      // Config is fresh in memory, but suggestions need revalidation
      const data = _sanitizeBootstrap(await get('getBootstrap'));
      if (data.status === 'success') {
        _writeSuggestionsCache(data);
        return data;
      }
      return _configCache; // Fallback to cached config if fetch fails
    }

    // Try localStorage config cache
    try {
      const cached = localStorage.getItem(OMS_CONFIG.CACHE_KEY_CONFIG);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if ((now - ts) < OMS_CONFIG.CACHE_TTL_CONFIG_MS) {
          _configCache = data;
          _configCachedAt = ts;
          
          // Config is fresh, but fetch full bootstrap to update suggestions
          const fresh = _sanitizeBootstrap(await get('getBootstrap'));
          if (fresh.status === 'success') {
            _writeConfigCache(fresh);
            _writeSuggestionsCache(fresh);
            return fresh;
          }
          return data; // Fallback
        }
      }
    } catch (e) { /* ignore */ }

    // No valid cache — fetch fresh
    const data = _sanitizeBootstrap(await get('getBootstrap'));
    if (data.status === 'success') {
      _writeConfigCache(data);
      _writeSuggestionsCache(data);
    }
    return data;
  }

  function readCachedBootstrap() {
    const now = Date.now();

    // Try in-memory first
    if (_configCache && (now - _configCachedAt) < OMS_CONFIG.CACHE_TTL_CONFIG_MS) {
      const suggestions = _readSuggestionsCache();
      return {
        status: 'success',
        config: _configCache.config,
        suggestions: suggestions?.suggestions || {},
        drafts: [],
        pending_count: 0
      };
    }

    // Try localStorage
    try {
      const configCached = localStorage.getItem(OMS_CONFIG.CACHE_KEY_CONFIG);
      if (configCached) {
        const { data, ts } = JSON.parse(configCached);
        if ((now - ts) < OMS_CONFIG.CACHE_TTL_CONFIG_MS) {
          _configCache = data;
          _configCachedAt = ts;

          const suggestions = _readSuggestionsCache();
          return {
            status: 'success',
            config: data.config,
            suggestions: suggestions?.suggestions || {},
            drafts: [],
            pending_count: 0
          };
        }
      }
    } catch (e) { /* ignore */ }

    return null;
  }

  function _writeConfigCache(data) {
    _configCache = data;
    _configCachedAt = Date.now();
    try {
      localStorage.setItem(OMS_CONFIG.CACHE_KEY_CONFIG, JSON.stringify({
        data,
        ts: _configCachedAt
      }));
    } catch (e) { /* ignore */ }
  }

  function _writeSuggestionsCache(data) {
    try {
      localStorage.setItem(OMS_CONFIG.CACHE_KEY_SUGGESTIONS, JSON.stringify({
        suggestions: data.suggestions,
        ts: Date.now()
      }));
    } catch (e) { /* ignore */ }
  }

  function _readSuggestionsCache() {
    try {
      const cached = localStorage.getItem(OMS_CONFIG.CACHE_KEY_SUGGESTIONS);
      if (!cached) return null;
      return JSON.parse(cached);
    } catch (e) {
      return null;
    }
  }

  function _cacheBootstrap(data) {
    _writeConfigCache(data);
    _writeSuggestionsCache(data);
  }

  // ─── OFFLINE QUEUE ────────────────────────────────────────────────────────

  function addToOfflineQueue(payload) {
    const queue = _getQueue();
    queue.push({ payload, queued_at: new Date().toISOString() });
    _saveQueue(queue);
    return queue.length;
  }

  function getOfflineCount() {
    return _getQueue().length;
  }

  async function syncOfflineQueue() {
    const queue = _getQueue();
    if (!queue.length) return { synced: 0, failed: 0 };

    const remaining = [];
    let synced = 0;

    for (const item of queue) {
      try {
        const res = await post({ action: 'submitOrder', ...item.payload });
        if (res.status === 'success' || res._html_response) {
          synced++;
        } else {
          remaining.push(item);
        }
      } catch (e) {
        remaining.push(item);
      }
    }

    _saveQueue(remaining);
    return { synced, failed: remaining.length };
  }

  function _getQueue() {
    try {
      return JSON.parse(localStorage.getItem(OMS_CONFIG.OFFLINE_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function _saveQueue(queue) {
    try {
      localStorage.setItem(OMS_CONFIG.OFFLINE_KEY, JSON.stringify(queue));
    } catch (e) { /* ignore */ }
  }

  // ─── SUB-CHANNEL HELPER ───────────────────────────────────────────────────

  function getSubChannels(config, channel) {
    const all = (config && config.REF_SubChannel) ? config.REF_SubChannel : [];
    if (!channel) return all;

    const onlineChannels  = ['Whatsapp', 'Instagram', 'Facebook'];
    const offlineChannels = ['Flea-market', 'Exhibition', 'Studio'];

    if (channel === 'Online')  return all.filter(s => onlineChannels.includes(s));
    if (channel === 'Offline') return all.filter(s => offlineChannels.includes(s));
    return all;
  }

  // ─── SKU HELPER ───────────────────────────────────────────────────────────

  function buildPartialSku(item) {
    const seg = (val, len, fallback) => {
      const str = String(val || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      return str.substring(0, len) || fallback;
    };

    const div = seg(item.division,     3, 'UNK');
    const fab = seg(item.fabric,       3, 'UNK');
    const cat = seg(item.category,     3, 'UNK');
    const sub = seg(item.sub_category, 3, 'STD');
    const col = seg(item.colour,       3, 'UNK');
    const siz = String(item.size || 'FS').trim().toUpperCase();

    return `${div}-${fab}-${cat}-${sub}-${col}-${siz}`;
  }

  // ─── DATE HELPER ─────────────────────────────────────────────────────────

  function todayLocal() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // ─── VALIDATION HELPERS ───────────────────────────────────────────────────

  function isValidPhone(phone) {
    const cleaned = String(phone || '').replace(/\D/g, '');
    return cleaned.length === 10;
  }

  // ─── STRING HELPERS ───────────────────────────────────────────────────────

  function toTitleCase(str) {
    return String(str || '')
      .replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }

  // ─── PUBLIC API ───────────────────────────────────────────────────────────

  return {
    get,
    post,
    getBootstrap,
    _sanitizeBootstrap,
    readCachedBootstrap,
    _cacheBootstrap,
    addToOfflineQueue,
    getOfflineCount,
    syncOfflineQueue,
    getSubChannels,
    buildPartialSku,
    todayLocal,
    isValidPhone,
    toTitleCase
  };

})();