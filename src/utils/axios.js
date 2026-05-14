import axios from 'axios';
import { getDeviceId } from './device';
import { getAuthToken } from './sessionStorage';
import { preloadAllCaches } from './indexedDb';

console.log('[cacheDB] axios module loaded');


const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5001/api',
  withCredentials: true,
});

let serverReachabilityProbe = null;
const shouldTriggerAuthExpired = (error) => {
  const status = error?.response?.status;
  if (status !== 401) return false;
  const url = String(error?.config?.url || '').toLowerCase();
  if (url.includes('/auth/getlogin')) return true;
  const code = String(error?.response?.data?.code || '').toLowerCase();
  const message = String(error?.response?.data?.message || '').toLowerCase();
  if (code.includes('invalid') && code.includes('token')) return true;
  if (message.includes('invalid token')) return true;
  if (message.includes('token expired')) return true;
  if (message.includes('jwt')) return true;
  if (message.includes('unauthorized')) return true;
  return false;
};

const probeServerReachability = async () => {
  if (serverReachabilityProbe) return serverReachabilityProbe;

  const baseURL = String(api.defaults.baseURL || '').replace(/\/$/, '');
  const pingUrl = `${baseURL}/auth/getLogin`;
  const token = typeof window !== 'undefined' ? await getAuthToken().catch(() => null) : null;

  serverReachabilityProbe = axios
    .get(pingUrl, {
      timeout: 5000,
      withCredentials: true,
      validateStatus: () => true,
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      serverReachabilityProbe = null;
    });

  return serverReachabilityProbe;
};

// 🔐 REGISTER INTERCEPTOR HERE (ONCE)
api.interceptors.request.use(
  async (config) => {
    const requestUrl = String(config?.url || '');
    const isAuthEndpoint = requestUrl.includes('/auth/');
    config.metadata = {
      startTime: typeof performance !== 'undefined' ? performance.now() : Date.now(),
    };
    const deviceId = getDeviceId();
    console.log('Sending device id:', deviceId); // 🔍 DEBUG
    config.headers['x-device-id'] = deviceId;
    try {
      const selectedBranchId = localStorage.getItem('selected_branch_id');
      if (!isAuthEndpoint && selectedBranchId && selectedBranchId !== 'all') {
        config.headers['x-branch-id'] = selectedBranchId;
      }
    } catch (err) {
      // ignore storage access issues
    }
    if (typeof window !== 'undefined') {
      try {
        const token = await getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (err) {
        // Ignore storage access issues
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Normalize network errors so callers don't crash on err.response being undefined.
api.interceptors.response.use(
  (response) => {
    const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const startTime = response?.config?.metadata?.startTime ?? endTime;
    const durationMs = Math.round(endTime - startTime);
    if (response?.config?.url) {
      console.log(`[API] ${response.config.method?.toUpperCase() || 'GET'} ${response.config.url} - ${durationMs}ms`);
    } else {
      console.log(`[API] Response time - ${durationMs}ms`);
    }
    if (typeof window !== 'undefined') {
      window.__serverOffline = false;
      window.dispatchEvent(new CustomEvent('server-status', { detail: { offline: false } }));
    }
    if (typeof window !== 'undefined') {
      const url = response?.config?.url || '';
      if (url.includes('/platform/config')) {
        console.log('[cacheDB] platform/config detected');
        preloadAllCaches().catch((err) => {
          console.error('[cacheDB] preload failed', err);
        });
      }
      if (url.includes('/auth/logout')) {
        window.__cacheDbPreloadFired = false;
        console.log('[cacheDB] reset preload flag on logout');
      }
      if (url.includes('/auth/login')) {
        console.log('[cacheDB] login response received');
      }
    }
    return response;
  },
  async (error) => {
    const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const startTime = error?.config?.metadata?.startTime ?? endTime;
    const durationMs = Math.round(endTime - startTime);
    if (error?.config?.url) {
      console.log(`[API] ${error.config.method?.toUpperCase() || 'GET'} ${error.config.url} - ${durationMs}ms (error)`);
    } else {
      console.log(`[API] Error response time - ${durationMs}ms`);
    }
    if (!error?.response) {
      if (error?.code === 'ERR_CANCELED') {
        return Promise.reject(error);
      }
      error.isNetworkError = true;
      error.response = {
        status: 0,
        data: { message: 'Network Error' },
      };
      if (typeof window !== 'undefined') {
        const browserOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
        if (browserOffline) {
          window.__serverOffline = true;
          window.dispatchEvent(new CustomEvent('server-status', { detail: { offline: true } }));
        } else {
          const reachable = await probeServerReachability();
          window.__serverOffline = !reachable;
          window.dispatchEvent(new CustomEvent('server-status', { detail: { offline: !reachable } }));
        }
      }
    }
    const status = error?.response?.status;
    if (typeof window !== 'undefined') {
      if (shouldTriggerAuthExpired(error)) {
        window.dispatchEvent(new CustomEvent('auth-expired'));
      }
      if (status === 402) {
        window.dispatchEvent(new CustomEvent('subscription-expired'));
      }
      if (status === 403) {
        const message = error?.response?.data?.message || 'Admin access only';
        window.dispatchEvent(new CustomEvent('forbidden', { detail: { message } }));
      }
    }
    return Promise.reject(error);
  }
);


const HEALTHCHECK_INTERVAL_MS = Number(process.env.REACT_APP_HEALTHCHECK_INTERVAL_MS) || 5 * 60 * 1000;
const HEALTHCHECK_ENABLED = String(process.env.REACT_APP_HEALTHCHECK_ENABLED || '').toLowerCase() === 'true';

const startHealthCheck = () => {
  if (typeof window === 'undefined') return;
  if (!HEALTHCHECK_ENABLED) return;
  if (window.__healthCheckInterval) return;

  const baseURL = api.defaults.baseURL || '';
  const healthUrl = baseURL.replace(/\/$/, '') + '/health';

  window.__healthCheckInterval = setInterval(() => {
    axios
      .get(healthUrl, { withCredentials: true, timeout: 5000 })
      .catch(() => {
        // Keepalive should be silent; failures are ignored.
      });
  }, HEALTHCHECK_INTERVAL_MS);
};

startHealthCheck();

export default api;
