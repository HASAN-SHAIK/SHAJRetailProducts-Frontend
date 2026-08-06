import * as storage from './internal/storage';

const CACHE_KEY = 'application_settings_cache_v1';

const DEFAULT_SETTINGS = {
  store: {
    invoice_prefix: 'INV',
    invoice_footer: 'Thank you for shopping with us.',
    currency: 'INR',
    auto_sync: true,
    notifications_enabled: true,
    biometric_lock: false,
  },
  tax: {
    default_tax_percent: '18',
    gst_mode: 'INCLUSIVE',
  },
  printer: {
    receipt_paper_width_mm: 80,
  },
  theme: {
    desktop: 'dark',
    mobile: 'dark',
  },
  permissions: {
    role: null,
    permissions: [],
    store_permissions: {},
  },
  company: {},
};

const mergeSettings = (incoming = {}) => ({
  store: { ...DEFAULT_SETTINGS.store, ...(incoming.store || {}) },
  tax: { ...DEFAULT_SETTINGS.tax, ...(incoming.tax || {}) },
  printer: { ...DEFAULT_SETTINGS.printer, ...(incoming.printer || {}) },
  theme: { ...DEFAULT_SETTINGS.theme, ...(incoming.theme || {}) },
  permissions: { ...DEFAULT_SETTINGS.permissions, ...(incoming.permissions || {}) },
  company: { ...(incoming.company || {}) },
});

/** @implements {import('../Interfaces/IApplicationSettingsRepository').IApplicationSettingsRepository} */
export class IndexedDbApplicationSettingsRepository {
  async getApplicationSettings() {
    const cached = await storage.getConfigValue(CACHE_KEY);
    return mergeSettings(cached || DEFAULT_SETTINGS);
  }

  async updateApplicationSettings(payload = {}) {
    const current = await this.getApplicationSettings();
    const next = mergeSettings({
      ...current,
      store: payload.store ? { ...current.store, ...payload.store } : current.store,
      tax: payload.tax ? { ...current.tax, ...payload.tax } : current.tax,
      printer: payload.printer ? { ...current.printer, ...payload.printer } : current.printer,
      theme: payload.theme ? { ...current.theme, ...payload.theme } : current.theme,
      company: payload.company ? { ...current.company, ...payload.company } : current.company,
    });
    await storage.saveConfigValue(CACHE_KEY, next);
    return next;
  }

  async getSettingGroup(group) {
    const settings = await this.getApplicationSettings();
    return settings[group] || {};
  }

  async updateSettingGroup(group, values = {}) {
    return this.updateApplicationSettings({ [group]: values });
  }
}
