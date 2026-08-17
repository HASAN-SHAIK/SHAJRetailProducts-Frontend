jest.mock('../services/local/sessionLocalService', () => ({
  clearSessionValue: jest.fn(() => Promise.resolve()),
  getSessionValue: jest.fn(() => Promise.resolve(null)),
}));

const {
  saveAuthToken,
  getAuthToken,
  saveSessionInfo,
  getSessionInfo,
  clearSessionInfo,
} = require('./sessionStorage');

const { clearSessionValue, getSessionValue } = require('../services/local/sessionLocalService');

describe('V1 browser persistence boundary', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    clearSessionValue.mockClear();
    getSessionValue.mockReset();
    getSessionValue.mockResolvedValue(null);
  });

  test('access JWTs are purged instead of being persisted in browser-readable storage', async () => {
    window.localStorage.setItem('auth_token', 'legacy-local-token');
    window.sessionStorage.setItem('auth_token', 'legacy-session-token');

    await saveAuthToken('new-secret-token');

    expect(window.localStorage.getItem('auth_token')).toBeNull();
    expect(window.sessionStorage.getItem('auth_token')).toBeNull();
    expect(clearSessionValue).toHaveBeenCalledWith('auth_token');
    await expect(getAuthToken()).resolves.toBeNull();
  });

  test('session metadata may persist but never carries an access token', async () => {
    await saveSessionInfo({
      userId: 'user-1',
      role: 'cashier',
      branchId: 'branch-1',
      token: 'must-not-persist',
    });

    const raw = window.localStorage.getItem('session_info');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw)).toEqual({
      userId: 'user-1',
      role: 'cashier',
      branchId: 'branch-1',
      token: null,
    });
    expect(window.sessionStorage.getItem('session_info')).toBeNull();
    await expect(getSessionInfo()).resolves.toMatchObject({
      userId: 'user-1',
      role: 'cashier',
      branchId: 'branch-1',
      token: null,
    });
  });

  test('legacy IndexedDB session metadata is sanitized before browser migration', async () => {
    getSessionValue.mockResolvedValueOnce({
      userId: 'legacy-user',
      role: 'cashier',
      token: 'legacy-indexeddb-token',
    });

    // Load a fresh module so the one-time migration runs against this fixture.
    jest.resetModules();
    const freshLocalService = require('../services/local/sessionLocalService');
    freshLocalService.getSessionValue.mockResolvedValueOnce({
      userId: 'legacy-user',
      role: 'cashier',
      token: 'legacy-indexeddb-token',
    });
    const freshSessionStorage = require('./sessionStorage');

    const info = await freshSessionStorage.getSessionInfo();

    expect(info).toEqual({
      userId: 'legacy-user',
      role: 'cashier',
      token: null,
    });
    expect(JSON.parse(window.localStorage.getItem('session_info'))).toEqual({
      userId: 'legacy-user',
      role: 'cashier',
      token: null,
    });
  });

  test('clearing session metadata removes both browser copies and IndexedDB compatibility state', async () => {
    window.localStorage.setItem('session_info', JSON.stringify({ userId: 'user-1', token: null }));
    window.sessionStorage.setItem('session_info', JSON.stringify({ userId: 'user-1', token: null }));

    await clearSessionInfo();

    expect(window.localStorage.getItem('session_info')).toBeNull();
    expect(window.sessionStorage.getItem('session_info')).toBeNull();
    expect(clearSessionValue).toHaveBeenCalledWith('session_info');
  });
});
