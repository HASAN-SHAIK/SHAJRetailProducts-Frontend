import api from '../utils/axios';
import { getConfigValue, saveConfigValue } from '../core/db';
import { resolveGstModeFromConfig } from './gstService';

const CONFIG_KEY = 'tenant_config';

export const fetchTenantConfig = async () => {
  const res = await api.get('/tenant/me');
  const payload = res?.data?.data || res?.data || {};
  const normalized = {
    ...payload,
    gst_mode: resolveGstModeFromConfig(payload),
  };
  await saveConfigValue(CONFIG_KEY, normalized);
  return normalized;
};

export const getCachedTenantConfig = async () => {
  const cached = await getConfigValue(CONFIG_KEY);
  if (!cached) return null;
  return {
    ...cached,
    gst_mode: resolveGstModeFromConfig(cached),
  };
};

export const resolveTenantConfig = async () => {
  try {
    return await fetchTenantConfig();
  } catch (error) {
    const cached = await getCachedTenantConfig();
    if (cached) return cached;
    return { gst_mode: 'INCLUSIVE' };
  }
};
