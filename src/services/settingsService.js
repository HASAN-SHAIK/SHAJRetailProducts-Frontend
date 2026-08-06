import api from '../utils/axios';
import { unwrapBody } from '../utils/apiClient';import {
  fetchApplicationSettingsRemote,
  updateApplicationSettingsRemote,
} from '../Repositories/api/applicationSettingsApiClient';

export const getSettings = async () => unwrapBody(await api.get('/settings'));

export const getApplicationSettings = async () => {
  const settings = await fetchApplicationSettingsRemote();
  return settings;
};

export const updateApplicationSettings = async (payload = {}) => updateApplicationSettingsRemote(payload);
