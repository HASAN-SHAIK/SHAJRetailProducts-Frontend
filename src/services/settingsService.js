import api from '../utils/axios';
import { canReadSettings } from '../utils/permissions';
import { unwrapBody } from '../utils/apiClient';import {
  fetchApplicationSettingsRemote,
  updateApplicationSettingsRemote,
} from '../Repositories/api/applicationSettingsApiClient';

export const getSettings = async (user = null) => {
  if (!canReadSettings(user)) {
    const error = new Error('Current user cannot read remote settings.');
    error.code = 'SETTINGS_READ_NOT_PERMITTED';
    throw error;
  }
  return unwrapBody(await api.get('/settings'));
};

export const getApplicationSettings = async () => {
  const settings = await fetchApplicationSettingsRemote();
  return settings;
};

export const updateApplicationSettings = async (payload = {}) => updateApplicationSettingsRemote(payload);
