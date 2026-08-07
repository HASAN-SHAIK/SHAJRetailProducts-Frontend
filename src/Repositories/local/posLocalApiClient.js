const DEFAULT_BASE_URL = 'http://127.0.0.1:4782/api/v1';

export const isLocalPosEnabled = () =>
  String(process.env.REACT_APP_POS_LOCAL_API_ENABLED || 'false').toLowerCase() === 'true';

const getBaseUrl = () =>
  String(process.env.REACT_APP_POS_LOCAL_API_URL || DEFAULT_BASE_URL).replace(/\/$/, '');

const getRuntimeToken = async () => {
  if (typeof window !== 'undefined') {
    const bridge = window.shajPosBridge;
    if (bridge && typeof bridge.getLocalApiToken === 'function') {
      const token = await bridge.getLocalApiToken();
      if (token) return String(token);
    }
    if (window.__SHAJ_POS_LOCAL_API_TOKEN__) {
      return String(window.__SHAJ_POS_LOCAL_API_TOKEN__);
    }
  }
  // Development-only fallback. Production installers should inject the token
  // through a desktop/native bridge instead of compiling it into the bundle.
  if (process.env.NODE_ENV !== 'production' && process.env.REACT_APP_POS_LOCAL_API_TOKEN) {
    return process.env.REACT_APP_POS_LOCAL_API_TOKEN;
  }
  throw new Error('local_pos_token_unavailable');
};

export const localPosRequest = async (path, { method = 'GET', body, signal } = {}) => {
  const token = await getRuntimeToken();
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method,
    signal,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-POS-Local-Token': token,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  if (response.status === 204) return null;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error || `local_pos_http_${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
};

export const localPosHealth = async () => {
  const response = await fetch(`${getBaseUrl()}/health`, { method: 'GET' });
  if (!response.ok) throw new Error(`local_pos_health_${response.status}`);
  return response.json();
};
