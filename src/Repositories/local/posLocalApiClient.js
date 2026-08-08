import { getSessionInfo } from '../../utils/sessionStorage';

const DEFAULT_BASE_URL = 'http://127.0.0.1:4782/api/v1';

export const isLocalPosEnabled = () =>
  String(process.env.REACT_APP_POS_LOCAL_API_ENABLED || 'false').toLowerCase() === 'true';

const getBaseUrl = () =>
  String(process.env.REACT_APP_POS_LOCAL_API_URL || DEFAULT_BASE_URL).replace(/\/$/, '');

if (isLocalPosEnabled()) {
  try {
    const url = new URL(getBaseUrl());
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('unsupported protocol');
    }
  } catch (error) {
    console.warn('[config] REACT_APP_POS_LOCAL_API_URL must be a valid HTTP(S) URL.');
  }
}

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
  if (process.env.NODE_ENV !== 'production' && process.env.REACT_APP_POS_LOCAL_API_TOKEN) {
    return process.env.REACT_APP_POS_LOCAL_API_TOKEN;
  }
  throw new Error('local_pos_token_unavailable');
};

const getUserContextHeaders = async () => {
  const session = await getSessionInfo().catch(() => null);
  const user = session?.user || {};
  const permissions = Array.isArray(session?.permissions)
    ? session.permissions
    : Array.isArray(user?.permissions)
      ? user.permissions
      : [];
  const headers = {};
  if (user?.id) headers['X-POS-User-ID'] = String(user.id);
  if (user?.role) headers['X-POS-User-Role'] = String(user.role);
  if (user?.tenant_id) headers['X-POS-Tenant-ID'] = String(user.tenant_id);
  if (user?.branch_id) headers['X-POS-Branch-ID'] = String(user.branch_id);
  if (permissions.length) headers['X-POS-Permissions'] = permissions.join(',');
  return headers;
};

export const localPosRequest = async (path, { method = 'GET', body, signal } = {}) => {
  const token = await getRuntimeToken();
  const userHeaders = await getUserContextHeaders();
  const url = `${getBaseUrl()}${path}`;
  if (process.env.NODE_ENV === 'development') {
    console.log(`[POS_LOCAL_API] ${method} ${url}`);
  }
  const response = await fetch(url, {
    method,
    signal,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-POS-Local-Token': token,
      ...userHeaders,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  if (response.status === 204) return null;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        `[POS_LOCAL_API] request failed ${method} ${url} status=${response.status} error=${payload?.error || ''}`
      );
    }
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
