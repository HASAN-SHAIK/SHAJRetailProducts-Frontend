const DEFAULT_BASE_URL = 'http://127.0.0.1:4782/api/v1';
const POS_SESSION_KEY = 'pos_local_session_token';
const POS_USER_KEY = 'pos_local_user_id';

export const isLocalPosEnabled = () =>
  String(process.env.REACT_APP_POS_LOCAL_API_ENABLED || 'false').toLowerCase() === 'true';

const getBaseUrl = () =>
  String(process.env.REACT_APP_POS_LOCAL_API_URL || DEFAULT_BASE_URL).replace(/\/$/, '');

if (isLocalPosEnabled()) {
  try {
    const url = new URL(getBaseUrl());
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
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
    if (window.__SHAJ_POS_LOCAL_API_TOKEN__) return String(window.__SHAJ_POS_LOCAL_API_TOKEN__);
  }
  if (process.env.NODE_ENV !== 'production' && process.env.REACT_APP_POS_LOCAL_API_TOKEN) {
    return process.env.REACT_APP_POS_LOCAL_API_TOKEN;
  }
  throw new Error('local_pos_token_unavailable');
};

const getLocalSessionToken = () => {
  if (typeof window === 'undefined') return null;
  try { return window.sessionStorage.getItem(POS_SESSION_KEY); } catch { return null; }
};

const setLocalSession = (token, userId) => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(POS_SESSION_KEY, token);
  if (userId) window.localStorage.setItem(POS_USER_KEY, String(userId));
};

export const clearLocalPosSession = () => {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.removeItem(POS_SESSION_KEY); } catch {}
};

export const getCachedLocalPosUserId = () => {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage.getItem(POS_USER_KEY); } catch { return null; }
};

const request = async (path, { method = 'GET', body, signal, requireSession = true, approvalToken = null } = {}) => {
  const machineToken = await getRuntimeToken();
  const sessionToken = requireSession ? getLocalSessionToken() : null;
  if (requireSession && !sessionToken) throw new Error('local_pos_session_unavailable');
  const url = `${getBaseUrl()}${path}`;
  const response = await fetch(url, {
    method,
    signal,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-POS-Local-Token': machineToken,
      ...(sessionToken ? { 'X-POS-Session-Token': sessionToken } : {}),
      ...(approvalToken ? { 'X-POS-Approval-Token': String(approvalToken) } : {}),
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

export const enrollLocalPosUser = async ({ offlineGrant, pin }) =>
  request('/auth/enroll', { method: 'POST', requireSession: false, body: { offline_grant: offlineGrant, pin } });

export const getLocalPosDevice = async () =>
  request('/device', { method: 'GET', requireSession: false });

export const loginLocalPosUser = async ({ userId, pin }) => {
  const payload = await request('/auth/login', { method: 'POST', requireSession: false, body: { user_id: String(userId), pin } });
  if (!payload?.session_token) throw new Error('local_pos_session_missing');
  setLocalSession(payload.session_token, payload?.user?.user_id || userId);
  return payload;
};

export const logoutLocalPosUser = async () => {
  try { await request('/auth/logout', { method: 'POST' }); } finally { clearLocalPosSession(); }
};

export const requestLocalManagerApproval = async ({ managerUserId, pin, permission, reason = '', orderId = '', actionScope = '' }) => {
  const normalizedOrderId = String(orderId || '').trim();
  const normalizedActionScope = String(actionScope || '').trim();
  const payload = await request('/auth/approvals', {
    method: 'POST',
    body: {
      manager_user_id: String(managerUserId),
      pin: String(pin),
      permission: String(permission),
      reason: String(reason || ''),
      ...(normalizedOrderId ? { order_id: normalizedOrderId } : {}),
      ...(normalizedActionScope ? { action_scope: normalizedActionScope } : {}),
    },
  });
  if (!payload?.approval_token) throw new Error('local_pos_approval_missing');
  return payload;
};

export const localPosRequest = async (path, options = {}) => request(path, options);

export const localPosHealth = async () => {
  const response = await fetch(`${getBaseUrl()}/health`, { method: 'GET' });
  if (!response.ok) throw new Error(`local_pos_health_${response.status}`);
  return response.json();
};
