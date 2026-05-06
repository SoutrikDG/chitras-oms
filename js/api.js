/**
 * CHITRAS OMS — Frontend API Layer
 * File: js/api.js
 *
 * Provides the OMS_API object used throughout app.jsx.
 * Handles all communication with the Apps Script backend,
 * offline queue management, caching, and utility helpers.
 */

const OMS_API = (() => {

  // ─── INTERNAL STATE ───────────────────────────────────────────────────────

  let _bootstrapCache = null;
  let _bootstrapCachedAt = 0;

  // ─── CORE FETCH HELPERS ───────────────────────────────────────────────────

  /**
   * GET request to the Apps Script web app.
   * action: string — e.g. 'getBootstrap', 'getRecentOrders'
   * params: object — optional extra query params e.g. { offset: 5, filter: 'pending' }
   */
  async function get(action, params = {}) {
    const url = new URL(OMS_CONFIG.API_URL);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow'
    });

    const text = await res.text();

    // Apps Script sometimes wraps responses in HTML on auth errors
    if (text.trim().startsWith('<')) {
      throw new Error('API returned HTML — check deployment URL and access settings');
    }

    return JSON.parse(text);
  }

  /**
   * POST request to the Apps Script web app.
   * payload: object — must include 'action' field
   */
  async function post(payload) {
    const res = await fetch(OMS_CONFIG.API_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });

    const text = await res.text();

    if (text.trim().startsWith('<')) {
      // Mark as potential success if Apps Script redirected
      // (known Apps Script POST redirect behavior)
      return { status: 'success', _html_response: true };
    }

    return JSON.parse(text);
  }

  // ─── BOOTSTRAP ────────────────────────────────────────────────────────────

  /**
   * Fetches config + suggestions + drafts + pending_count in one call.
   * Uses a 5-minute in-memory cache to avoid redundant calls.
   */
  async function getBootstrap() {
    const now = Date.now();
    if (_bootstrapCache && (now - _bootstrapCachedAt) < OMS_CONFIG.CACHE_TTL_MS) {
      return _bootstrapCache;
    }

    // Try localStorage cache first (survives page reload)
    try {
      const cached = localStorage.getItem(OMS_CONFIG.CACHE_KEY);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if ((now - ts) < OMS_CONFIG.CACHE_TTL_MS) {
          _bootstrapCache = data;
          _bootstrapCachedAt = ts;
          return data;
        }
      }
    } catch (e) { /* ignore */ }

    const data = await get('getBootstrap');

    if (data.status === 'success') {
      _bootstrapCache = data;
      _bootstrapCachedAt = now;
      try {
        localStorage.setItem(OMS_CONFIG.CACHE_KEY, JSON.stringify({ data, ts: now }));
      } catch (e) { /* ignore */ }
    }

    return data;
  }

  /**
   * Force-writes to the internal cache.
   * Called by App after a fresh bootstrap fetch to keep cache warm.
   */
  function _cacheBootstrap(data) {
    _bootstrapCache = data;
    _bootstrapCachedAt = Date.now();
    try {
      localStorage.setItem(OMS_CONFIG.CACHE_KEY, JSON.stringify({ data, ts: _bootstrapCachedAt }));
    } catch (e) { /* ignore */ }
  }

  // ─── OFFLINE QUEUE ────────────────────────────────────────────────────────

  /**
   * Adds a complete order payload to the offline queue in localStorage.
   * Returns the new queue length.
   */
  function addToOfflineQueue(payload) {
    const queue = _getQueue();
    queue.push({ payload, queued_at: new Date().toISOString() });
    _saveQueue(queue);
    return queue.length;
  }

  /**
   * Returns the number of orders currently in the offline queue.
   */
  function getOfflineCount() {
    return _getQueue().length;
  }

  /**
   * Attempts to submit all queued offline orders.
   * Returns { synced: N, failed: M }
   */
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

  /**
   * Returns the correct sub-channel options based on selected channel.
   * Online  → Whatsapp, Instagram, Facebook
   * Offline → Flea-market, Exhibition, Studio
   * Falls back to full REF_SubChannel list if channel not set.
   */
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

  /**
   * Builds a partial SKU from an item object for price suggestion lookups.
   * Matches the format used in coresystem.gs generateSku:
   * DIV-FAB-CAT-SUB-COL-SIZ
   * Uses UNK for missing fields — caller checks for UNK to decide if usable.
   */
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

  /**
   * Returns today's date as YYYY-MM-DD in local time (IST-safe).
   * Uses the device's local date — no timezone conversion needed
   * since the user is always in IST.
   */
  function todayLocal() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // ─── VALIDATION HELPERS ───────────────────────────────────────────────────

  /**
   * Validates that a phone number is exactly 10 digits.
   */
  function isValidPhone(phone) {
    const cleaned = String(phone || '').replace(/\D/g, '');
    return cleaned.length === 10;
  }

  // ─── STRING HELPERS ───────────────────────────────────────────────────────

  /**
   * Converts a string to Title Case.
   * e.g. "john doe" → "John Doe"
   */
  function toTitleCase(str) {
    return String(str || '')
      .replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }

  // ─── PUBLIC API ───────────────────────────────────────────────────────────

  return {
    get,
    post,
    getBootstrap,
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