import {
  fetchApplicationSettingsRemote,
  isOnline,
  readSettingsCache,
  updateApplicationSettingsRemote,
  writeSettingsCache,
} from './api/applicationSettingsApiClient';

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
export class ApiApplicationSettingsRepository {
  async getApplicationSettings() {
    if (isOnline()) {
      try {
        const settings = await fetchApplicationSettingsRemote();
        if (settings) {
          await writeSettingsCache(settings).catch(() => {});
          return settings;
        }
      } catch {
        // fall back to in-memory/default settings
      }
    }
    const cached = await readSettingsCache().catch(() => null);
    return mergeSettings(cached || DEFAULT_SETTINGS);
  }

  async updateApplicationSettings(payload = {}) {
    if (isOnline()) {
      try {
        const settings = await updateApplicationSettingsRemote(payload);
        if (settings) {
          await writeSettingsCache(settings).catch(() => {});
          return settings;
        }
      } catch {
        // fall back to in-memory/default settings
      }
    }
    const current = await this.getApplicationSettings();
    return mergeSettings({ ...current, ...payload });
  }

  async getSettingGroup(group) {
    const settings = await this.getApplicationSettings();
    return settings[group] || {};
  }

  async updateSettingGroup(group, values = {}) {
    return this.updateApplicationSettings({ [group]: values });
  }
}
