jest.mock('../services/local/sessionLocalService', () => ({
  clearSessionValue: jest.fn(() => Promise.resolve()),
  getSessionValue: jest.fn(() => Promise.resolve(null)),
}));

const loadPersistenceModules = () => {
  jest.resetModules();
  const localService = require('../services/local/sessionLocalService');
  const sessionStorage = require('./sessionStorage');
  return { localService, sessionStorage };
};

describe('V1 browser persistence boundary', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  test('access JWTs are purged instead of persisted in browser-readable storage', async () => {
    const { localService, sessionStorage } = loadPersistenceModules();
    window.localStorage.setItem('auth_token', 'legacy-local-token');
    window.sessionStorage.setItem('auth_token', 'legacy-session-token');

    await sessionStorage.saveAuthToken('new-secret-token');

    expect(window.localStorage.getItem('auth_token')).toBeNull();
    expect(window.sessionStorage.getItem('auth_token')).toBeNull();
    expect(localService.clearSessionValue).toHaveBeenCalledWith('auth_token');
    await expect(sessionStorage.getAuthToken()).resolves.toBeNull();
  });

  test('session metadata may persist but never carries an access token', async () => {
    const { sessionStorage } = loadPersistenceModules();

    await sessionStorage.saveSessionInfo({
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
    await expect(sessionStorage.getSessionInfo()).resolves.toMatchObject({
      userId: 'user-1',
      role: 'cashier',
      branchId: 'branch-1',
      token: null,
    });
  });

  test('legacy browser session metadata is sanitized before browser migration', async () => {
    const { localService, sessionStorage } = loadPersistenceModules();
    localService.getSessionValue.mockResolvedValueOnce({
      userId: 'legacy-user',
      role: 'cashier',
      token: 'legacy-browser-token',
    });

    const info = await sessionStorage.getSessionInfo();

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
    expect(localService.clearSessionValue).toHaveBeenCalledWith('session_info');
  });

  test('clearing session metadata removes browser copies and local compatibility state', async () => {
    const { localService, sessionStorage } = loadPersistenceModules();
    window.localStorage.setItem('session_info', JSON.stringify({ userId: 'user-1', token: null }));
    window.sessionStorage.setItem('session_info', JSON.stringify({ userId: 'user-1', token: null }));

    await sessionStorage.clearSessionInfo();

    expect(window.localStorage.getItem('session_info')).toBeNull();
    expect(window.sessionStorage.getItem('session_info')).toBeNull();
    expect(localService.clearSessionValue).toHaveBeenCalledWith('session_info');
  });
});
