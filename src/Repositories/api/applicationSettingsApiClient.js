import api from '../../utils/axios';
import { unwrapRecord } from '../../utils/apiClient';
import { canManageApplicationSettings, canReadSettings } from '../../utils/permissions';

const CACHE_KEY = 'application_settings_cache_v1';

export const fetchApplicationSettingsRemote = async () => {
  if (!canReadSettings()) {
    const error = new Error('Current user cannot read remote application settings.');
    error.code = 'SETTINGS_READ_NOT_PERMITTED';
    throw error;
  }
  const response = await api.get('/settings/application');
  return unwrapRecord(response, ['settings']);
};

export const updateApplicationSettingsRemote = async (payload = {}) => {
  if (!canManageApplicationSettings()) {
    const error = new Error('Current user cannot update remote application settings.');
    error.code = 'SETTINGS_WRITE_NOT_PERMITTED';
    throw error;
  }
  const response = await api.put('/settings/application', payload);
  return unwrapRecord(response, ['settings']);
};

export const readSettingsCache = async () => {
  const { getConfigValue } = await import('../../services/local/configLocalService');
  return getConfigValue(CACHE_KEY);
};

export const writeSettingsCache = async (settings) => {
  const { saveConfigValue } = await import('../../services/local/configLocalService');
  await saveConfigValue(CACHE_KEY, settings);
};

export { isOnline } from '../../utils/apiClient';
export { CACHE_KEY };
