import { IndexedDbApplicationSettingsRepository } from './IndexedDbApplicationSettingsRepository';
import {
  fetchApplicationSettingsRemote,
  isOnline,
  updateApplicationSettingsRemote,
  writeSettingsCache,
} from './api/applicationSettingsApiClient';

/** @implements {import('../Interfaces/IApplicationSettingsRepository').IApplicationSettingsRepository} */
export class ApiApplicationSettingsRepository {
  constructor() {
    this.cache = new IndexedDbApplicationSettingsRepository();
  }

  async getApplicationSettings() {
    if (isOnline()) {
      try {
        const settings = await fetchApplicationSettingsRemote();
        if (settings) {
          await writeSettingsCache(settings).catch(() => {});
          return settings;
        }
      } catch {
        // fall back to local cache
      }
    }
    return this.cache.getApplicationSettings();
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
        // fall back to local cache
      }
    }
    return this.cache.updateApplicationSettings(payload);
  }

  async getSettingGroup(group) {
    const settings = await this.getApplicationSettings();
    return settings[group] || {};
  }

  async updateSettingGroup(group, values = {}) {
    return this.updateApplicationSettings({ [group]: values });
  }
}
