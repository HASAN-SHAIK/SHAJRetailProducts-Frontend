import { clearSessionValue, getSessionValue, saveSessionValue } from '../core/db';

const AUTH_TOKEN_KEY = 'auth_token';
const SESSION_INFO_KEY = 'session_info';
let migrationAttempted = false;

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

export const saveAuthToken = async (token) => {
  if (!token) {
    await clearSessionValue(AUTH_TOKEN_KEY);
    return;
  }
  await saveSessionValue(AUTH_TOKEN_KEY, token);
};

export const getAuthToken = async () => {
  try {
    const token = await getSessionValue(AUTH_TOKEN_KEY);
    if (token) return token;
  } catch (err) {
    // fall through to legacy
  }

  if (!migrationAttempted) {
    migrationAttempted = true;
    const legacy = readLegacyToken();
    if (legacy) {
      try {
        await saveSessionValue(AUTH_TOKEN_KEY, legacy);
        clearLegacyToken();
      } catch (err) {
        return legacy;
      }
      return legacy;
    }
  }

  return null;
};

export const clearAuthToken = async () => {
  await clearSessionValue(AUTH_TOKEN_KEY);
  clearLegacyToken();
};

export const saveSessionInfo = async (info) => {
  if (!info) {
    await clearSessionValue(SESSION_INFO_KEY);
    return;
  }
  await saveSessionValue(SESSION_INFO_KEY, info);
};

export const getSessionInfo = async () => {
  return await getSessionValue(SESSION_INFO_KEY);
};

export const clearSessionInfo = async () => {
  await clearSessionValue(SESSION_INFO_KEY);
};

export const migrateAuthTokenFromLocalStorage = async () => {
  if (migrationAttempted) return null;
  migrationAttempted = true;
  const legacy = readLegacyToken();
  if (!legacy) return null;
  try {
    await saveSessionValue(AUTH_TOKEN_KEY, legacy);
    clearLegacyToken();
  } catch (err) {
    return legacy;
  }
  return legacy;
};
