import api from '../utils/axios';
import { getConfigValue, saveConfigValue } from './local/configLocalService';
import { resolveGstModeFromConfig } from './gstService';

const CONFIG_KEY = 'tenant_config';

const resolveSubscriptionStatus = (payload) => {
  const explicit = payload?.subscription_status || payload?.subscriptionStatus;
  if (explicit) return explicit;

  if (payload?.subscription?.is_expired === true) return 'expired';
  if (payload?.subscription?.is_expired === false) return 'active';

  return null;
};

const normalizeTenantConfig = (payload) => ({
  ...payload,
  gst_mode: resolveGstModeFromConfig(payload),
  subscription_status: resolveSubscriptionStatus(payload),
});

export const fetchTenantConfig = async () => {
  const res = await api.get('/tenant/me');
  const payload = res?.data?.data || res?.data || {};
  const normalized = normalizeTenantConfig(payload);
  await saveConfigValue(CONFIG_KEY, normalized);
  return normalized;
};

export const getCachedTenantConfig = async () => {
  const cached = await getConfigValue(CONFIG_KEY);
  if (!cached) return null;
  return normalizeTenantConfig(cached);
};

export const resolveTenantConfig = async () => {
  try {
    return await fetchTenantConfig();
  } catch (error) {
    const code = error?.response?.data?.code;
    if (code === 'SUBSCRIPTION_INACTIVE' || code === 'SUBSCRIPTION_REQUIRED') {
      throw error;
    }
    const cached = await getCachedTenantConfig();
    if (cached) return cached;
    return { gst_mode: 'INCLUSIVE' };
  }
};
