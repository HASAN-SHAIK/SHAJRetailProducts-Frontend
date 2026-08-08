import api from '../utils/axios';
import {
  saveAuthToken,
  saveSessionInfo,
  clearAuthToken,
  clearSessionInfo,
  getAuthToken,
} from '../utils/sessionStorage';

export const login = async ({ email, password, device_id, branch_id, remember_me = true }) => {
  const res = await api.post('/auth/login', {
    email,
    password,
    device_id,
    branch_id,
    remember_me,
  });

  if (res.data?.token) await saveAuthToken(res.data.token);

  const userPayload = res.data?.user || null;
  if (userPayload) {
    await saveSessionInfo({
      token: res.data?.token || null,
      user: userPayload,
      permissions: res.data?.permissions || userPayload.permissions || [],
      store_permissions: res.data?.store_permissions || userPayload.store_permissions || null,
      remember_me: res.data?.remember_me === true,
    });
  }
  return res.data;
};

export const issueOfflinePosGrant = async () => {
  const res = await api.post('/auth/offline-grant');
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
  if (res.data?.token) await saveAuthToken(res.data.token);
  if (res.data?.user) {
    await saveSessionInfo({
      token: res.data?.token || null,
      user: res.data.user,
      permissions: res.data?.permissions || res.data.user?.permissions || [],
      store_permissions: res.data?.store_permissions || res.data.user?.store_permissions || null,
      remember_me: res.data?.remember_me === true,
    });
  }
  return res.data;
};

export const validateSession = async () => {
  const res = await api.get('/auth/getLogin');
  if (res.data?.user) {
    const existingToken = await getAuthToken().catch(() => null);
    await saveSessionInfo({
      token: existingToken,
      user: res.data.user,
      permissions: res.data?.permissions || res.data.user?.permissions || [],
      store_permissions: res.data?.store_permissions || res.data.user?.store_permissions || null,
    });
  }
  return res.data;
};

export const ensureValidAccessToken = async () => {
  const token = await getAuthToken().catch(() => null);
  if (token) return token;
  try {
    const data = await refreshSession();
    return data?.token || null;
  } catch (err) {
    return null;
  }
};
