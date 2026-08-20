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

const clearLegacyToken = () => {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch (err) {
    // ignore
  }
};

const purgeLegacyAccessToken = async () => {
  clearBrowserValue(AUTH_TOKEN_KEY);
  clearLegacyToken();
  await clearSessionValue(AUTH_TOKEN_KEY).catch(() => {});
};

const migrateSessionInfoFromLocalStoreOnce = async () => {
  if (migrationAttempted) return;
  migrationAttempted = true;
  try {
    // V1 Central auth is HttpOnly-cookie based. Old browser/local/session
    // access tokens are deleted rather than migrated back into JavaScript.
    await purgeLegacyAccessToken();
    const localSession = await getSessionValue(SESSION_INFO_KEY);
    if (localSession && !readBrowserValue(SESSION_INFO_KEY, true)) {
      writeBrowserValue(SESSION_INFO_KEY, { ...localSession, token: null }, true);
    }
    if (localSession) {
      await clearSessionValue(SESSION_INFO_KEY).catch(() => {});
    }
  } catch (err) {
    // ignore migration issues
  }
};

// Retained for compatibility with older callers. Access JWTs are never stored
// in JavaScript-readable browser state; Central's HttpOnly cookie is authority.
export const saveAuthToken = async () => {
  await purgeLegacyAccessToken();
};

export const getAuthToken = async () => {
  await migrateSessionInfoFromLocalStoreOnce();
  await purgeLegacyAccessToken();
  return null;
};

export const clearAuthToken = async () => {
  await purgeLegacyAccessToken();
};

export const saveSessionInfo = async (info) => {
  if (!info) {
    clearBrowserValue(SESSION_INFO_KEY);
    await clearSessionValue(SESSION_INFO_KEY).catch(() => {});
    return;
  }
  writeBrowserValue(SESSION_INFO_KEY, { ...info, token: null }, true);
};

export const getSessionInfo = async () => {
  await migrateSessionInfoFromLocalStoreOnce();
  const info = readBrowserValue(SESSION_INFO_KEY, true);
  if (info) return { ...info, token: null };
  try {
    const localSession = await getSessionValue(SESSION_INFO_KEY);
    return localSession ? { ...localSession, token: null } : null;
  } catch (err) {
    return null;
  }
};

export const clearSessionInfo = async () => {
  clearBrowserValue(SESSION_INFO_KEY);
  await clearSessionValue(SESSION_INFO_KEY).catch(() => {});
};

export const migrateAuthTokenFromLocalStorage = async () => {
  await purgeLegacyAccessToken();
  return null;
};
