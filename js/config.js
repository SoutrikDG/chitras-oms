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
  OFFLINE_KEY:  'chitras_offline_queue',
  CACHE_KEY:    'chitras_bootstrap_cache',
  CACHE_TTL_MS: 5 * 60 * 1000,
  MAX_DRAFTS:   5,
  DEFAULT_ORDER_TYPE: 'Product'
};