import axios from 'axios';
import { getDeviceId } from './device';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
});

// 🔐 REGISTER INTERCEPTOR HERE (ONCE)
api.interceptors.request.use(
  (config) => {
    const deviceId = getDeviceId();
    console.log('Sending device id:', deviceId); // 🔍 DEBUG
    config.headers['x-device-id'] = deviceId;
    return config;
  },
  (error) => Promise.reject(error)
);

// Normalize network errors so callers don't crash on err.response being undefined.
api.interceptors.response.use(
  (response) => {
    if (typeof window !== 'undefined') {
      window.__serverOffline = false;
      window.dispatchEvent(new CustomEvent('server-status', { detail: { offline: false } }));
    }
    return response;
  },
  (error) => {
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
    return Promise.reject(error);
  }
);

export default api;
