import api from '../../utils/axios';
import { unwrapRecord } from '../../utils/apiClient';

const CACHE_KEY = 'application_settings_cache_v1';

export const fetchApplicationSettingsRemote = async () => {
  const response = await api.get('/settings/application');
  return unwrapRecord(response, ['settings']);
};

export const updateApplicationSettingsRemote = async (payload = {}) => {
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
