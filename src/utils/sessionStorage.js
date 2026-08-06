import { clearSessionValue, getSessionValue } from '../services/local/sessionLocalService';

const AUTH_TOKEN_KEY = 'auth_token';
const SESSION_INFO_KEY = 'session_info';
let migrationAttempted = false;

const readBrowserValue = (key, persistent = false) => {
  if (typeof window === 'undefined') return null;
  try {
    const storage = persistent ? window.localStorage : window.sessionStorage;
    const raw = storage.getItem(key);
    if (!raw) return null;
    if (key === SESSION_INFO_KEY) {
      try {
        return JSON.parse(raw);
      } catch (err) {
        return null;
      }
    }
    return raw;
  } catch (err) {
    return null;
  }
};

const writeBrowserValue = (key, value, persistent = false) => {
  if (typeof window === 'undefined') return;
  const storage = persistent ? window.localStorage : window.sessionStorage;
  if (value === null || value === undefined || value === '') {
    storage.removeItem(key);
    return;
  }
  if (key === SESSION_INFO_KEY) {
    storage.setItem(key, JSON.stringify(value));
    return;
  }
  storage.setItem(key, String(value));
};

const clearBrowserValue = (key) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(key);
    window.localStorage.removeItem(key);
  } catch (err) {
    // ignore
  }
};

const readLegacyToken = () => {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch (err) {
    return null;
  }
};

const clearLegacyToken = () => {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch (err) {
    // ignore
  }
};

const migrateFromIndexedDbOnce = async () => {
  if (migrationAttempted) return;
  migrationAttempted = true;
  try {
    const indexedToken = await getSessionValue(AUTH_TOKEN_KEY);
    if (indexedToken && !readBrowserValue(AUTH_TOKEN_KEY)) {
      writeBrowserValue(AUTH_TOKEN_KEY, indexedToken, false);
    }
    const indexedSession = await getSessionValue(SESSION_INFO_KEY);
    if (indexedSession && !readBrowserValue(SESSION_INFO_KEY, true)) {
      writeBrowserValue(SESSION_INFO_KEY, indexedSession, true);
    }
    if (indexedToken) {
      await clearSessionValue(AUTH_TOKEN_KEY).catch(() => {});
    }
    if (indexedSession) {
      await clearSessionValue(SESSION_INFO_KEY).catch(() => {});
    }
  } catch (err) {
    // ignore migration issues
  }
};

export const saveAuthToken = async (token) => {
  if (!token) {
    clearBrowserValue(AUTH_TOKEN_KEY);
    await clearSessionValue(AUTH_TOKEN_KEY).catch(() => {});
    return;
  }
  writeBrowserValue(AUTH_TOKEN_KEY, token, false);
};

export const getAuthToken = async () => {
  await migrateFromIndexedDbOnce();

  const token = readBrowserValue(AUTH_TOKEN_KEY, false);
  if (token) return token;

  const legacy = readLegacyToken();
  if (legacy) {
    writeBrowserValue(AUTH_TOKEN_KEY, legacy, false);
    clearLegacyToken();
    return legacy;
  }

  return null;
};

export const clearAuthToken = async () => {
  clearBrowserValue(AUTH_TOKEN_KEY);
  clearLegacyToken();
  await clearSessionValue(AUTH_TOKEN_KEY).catch(() => {});
};

export const saveSessionInfo = async (info) => {
  if (!info) {
    clearBrowserValue(SESSION_INFO_KEY);
    await clearSessionValue(SESSION_INFO_KEY).catch(() => {});
    return;
  }
  writeBrowserValue(SESSION_INFO_KEY, info, true);
};

export const getSessionInfo = async () => {
  await migrateFromIndexedDbOnce();
  const info = readBrowserValue(SESSION_INFO_KEY, true);
  if (info) return info;
  try {
    return await getSessionValue(SESSION_INFO_KEY);
  } catch (err) {
    return null;
  }
};

export const clearSessionInfo = async () => {
  clearBrowserValue(SESSION_INFO_KEY);
  await clearSessionValue(SESSION_INFO_KEY).catch(() => {});
};

export const migrateAuthTokenFromLocalStorage = async () => {
  await migrateFromIndexedDbOnce();
  const legacy = readLegacyToken();
  if (!legacy) return null;
  writeBrowserValue(AUTH_TOKEN_KEY, legacy, false);
  clearLegacyToken();
  return legacy;
};
