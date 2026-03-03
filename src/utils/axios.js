import axios from 'axios';
import { getDeviceId } from './device';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
});

// 🔐 REGISTER INTERCEPTOR HERE (ONCE)
api.interceptors.request.use(
  (config) => {
    config.metadata = {
      startTime: typeof performance !== 'undefined' ? performance.now() : Date.now(),
    };
    const deviceId = getDeviceId();
    console.log('Sending device id:', deviceId); // 🔍 DEBUG
    config.headers['x-device-id'] = deviceId;
    if (typeof window !== 'undefined') {
      try {
        const token = localStorage.getItem('auth_token');
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
    return response;
  },
  (error) => {
    const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const startTime = error?.config?.metadata?.startTime ?? endTime;
    const durationMs = Math.round(endTime - startTime);
    if (error?.config?.url) {
      console.log(`[API] ${error.config.method?.toUpperCase() || 'GET'} ${error.config.url} - ${durationMs}ms (error)`);
    } else {
      console.log(`[API] Error response time - ${durationMs}ms`);
    }
    if (!error?.response) {
      error.isNetworkError = true;
      error.response = {
        status: 0,
        data: { message: 'Network Error' },
      };
      if (typeof window !== 'undefined') {
        window.__serverOffline = true;
        window.dispatchEvent(new CustomEvent('server-status', { detail: { offline: true } }));
      }
    }
    const status = error?.response?.status;
    if (typeof window !== 'undefined') {
      if (status === 401) {
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
