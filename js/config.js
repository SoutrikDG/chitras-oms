/**
 * CHITRAS OMS — Frontend Configuration
 * Edit API_URL after each Apps Script redeployment.
 */
const OMS_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbyTLFbhzWlZZjozKkiU2uIu9939M89dHkdGDdOKgP2LGhhozEydEJkO4NjHECYmO3d1/exec',
  EMPTY_ITEM: {
    division: '', fabric: '', category: '', sub_category: '',
    size: '', colour: '', quantity: 1, base_price: ''
  },
  OFFLINE_KEY:           'chitras_offline_queue',
  CACHE_KEY_CONFIG:      'chitras_config_cache',      // 24hr cache
  CACHE_KEY_SUGGESTIONS: 'chitras_suggestions_cache', // SWR cache
  CACHE_TTL_CONFIG_MS:   24 * 60 * 60 * 1000,        // 24 hours
  CACHE_TTL_SUGGESTIONS_MS: 5 * 60 * 1000,           // 5 min (but always revalidate)
  MAX_DRAFTS:   5,
  DEFAULT_ORDER_TYPE: 'Product'
};