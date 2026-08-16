import api from '../utils/axios';
import {
  saveSessionInfo,
  clearAuthToken,
  clearSessionInfo,
} from '../utils/sessionStorage';

const persistCentralSession = async (data) => {
  // Central interactive auth is cookie-based. Never persist the access JWT in
  // JavaScript-readable browser storage; clear any pre-V1 bearer token instead.
  await clearAuthToken();
  const userPayload = data?.user || null;
  if (userPayload) {
    await saveSessionInfo({
      token: null,
      user: userPayload,
      permissions: data?.permissions || userPayload.permissions || [],
      store_permissions: data?.store_permissions || userPayload.store_permissions || null,
      remember_me: data?.remember_me === true,
    });
  }
};

export const login = async ({ email, password, device_id, branch_id, remember_me = true }) => {
  const res = await api.post('/auth/login', {
    email,
    password,
    device_id,
    branch_id,
    remember_me,
  });
  await persistCentralSession(res.data);
  return res.data;
};

export const issueOfflinePosGrant = async ({ deviceId }) => {
  const res = await api.post('/auth/offline-grant', { device_id: deviceId });
  return res.data;
};

export const logout = async () => {
  try {
    await api.post('/auth/logout');
  } finally {
    await clearAuthToken();
    await clearSessionInfo();
  }
};

export const refreshSession = async () => {
  const res = await api.post('/auth/refresh');
  await persistCentralSession(res.data);
  return res.data;
};

export const validateSession = async () => {
  const res = await api.get('/auth/getLogin');
  await persistCentralSession(res.data);
  return res.data;
};

// Compatibility helper for older callers. Central no longer exposes a bearer
// token to browser code; successful refresh means the HttpOnly cookie session is
// valid and the caller should use the shared credentialed API client.
export const ensureValidAccessToken = async () => {
  try {
    await refreshSession();
    return null;
  } catch (err) {
    return null;
  }
};
