const fs = require('fs');
const path = require('path');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8');

const protectedRoute = fs.readFileSync(path.join(__dirname, 'protectedRoute.jsx'), 'utf8');
const login = read('components/Login/Login.js');
const logout = read('pages/Logout.jsx');
const localClient = read('Repositories/local/posLocalApiClient.js');
const axiosClient = read('utils/axios.js');

describe('V1 Frontend authentication authorization boundary', () => {
  test('offline protected routes require a POSService-validated local session, not only cached Central user data', () => {
    expect(protectedRoute).toContain('networkDown && isLocalPosEnabled()');
    expect(protectedRoute).toContain('await validateLocalPosSession()');
    expect(protectedRoute).not.toContain('if (networkDown) {\n          const session');
  });

  test('offline login remains explicit PIN authentication against POSService', () => {
    expect(login).toContain("loginLocalPosUser({ userId: cachedUserId, pin: form.posPin })");
    expect(login).toContain('Central server is offline. Enter your POS PIN and choose Continue Offline.');
    expect(login).toContain('Offline authorization has expired. Connect to the central server and sign in again.');
  });

  test('local session validation uses an authenticated POSService endpoint', () => {
    expect(localClient).toContain("export const validateLocalPosSession = async () =>");
    expect(localClient).toContain("request('/diagnostics', { method: 'GET', requireSession: true })");
  });

  test('logout clears both Central/browser auth and the POS local session', () => {
    expect(logout).toContain('await sqlLogout()');
    expect(logout).toContain('await logoutLocalPosUser()');
    expect(localClient).toContain('finally { clearLocalPosSession(); }');
  });

  test('401 refresh and 403 forbidden UX remain wired centrally', () => {
    expect(axiosClient).toContain("status === 401");
    expect(axiosClient).toContain("!requestUrl.includes('/auth/refresh')");
    expect(axiosClient).toContain("window.dispatchEvent(new CustomEvent('auth-expired'))");
    expect(axiosClient).toContain("window.dispatchEvent(new CustomEvent('forbidden', { detail: { message } }))");
  });
});
