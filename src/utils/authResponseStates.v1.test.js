const fs = require('fs');
const path = require('path');

const axiosSource = fs.readFileSync(path.join(__dirname, 'axios.js'), 'utf8');
const appSource = fs.readFileSync(path.join(__dirname, '..', 'App.js'), 'utf8');

describe('V1 global authentication response states', () => {
  test('retries an ordinary 401 once through the HttpOnly cookie refresh path', () => {
    expect(axiosSource).toContain('status === 401');
    expect(axiosSource).toContain('!originalRequest._authRetried');
    expect(axiosSource).toContain('await refreshAccessToken();');
    expect(axiosSource).toContain('return api(originalRequest);');
  });

  test('expired authentication becomes an explicit application event and logout redirect', () => {
    expect(axiosSource).toContain("new CustomEvent('auth-expired')");
    expect(appSource).toContain("window.addEventListener('auth-expired', handleAuthExpired)");
    expect(appSource).toContain("navigate('/logout')");
  });

  test('403 authorization denial becomes an actionable access message without changing authority', () => {
    expect(axiosSource).toContain('status === 403');
    expect(axiosSource).toContain("new CustomEvent('forbidden', { detail: { message } })");
    expect(appSource).toContain("window.addEventListener('forbidden', handleForbidden)");
    expect(appSource).toContain("showPopup(message, 'Access')");
  });

  test('network failures remain distinct from authorization failures', () => {
    expect(axiosSource).toContain('error.isNetworkError = true');
    expect(axiosSource).toContain("new CustomEvent('server-status', { detail: { offline: true } })");
  });
});
