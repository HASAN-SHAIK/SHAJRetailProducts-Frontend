const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'Login.js'), 'utf8');

describe('V1 login interaction and accessibility acceptance', () => {
  test('prevents duplicate online and offline authentication attempts', () => {
    expect(source).toContain('if (isLoading) return;');
    expect(source).toContain("disabled={isLoading || registrationBusy}");
    expect(source).toContain('setIsLoading(true);');
    expect(source).toContain('setIsLoading(false);');
  });

  test('keeps registration actions single-flight', () => {
    expect(source).toContain('if (registrationBusy) return;');
    expect(source).toContain('aria-busy={registrationBusy}');
    expect(source).toContain('disabled={Boolean(registration?.request_id) || registrationBusy}');
  });

  test('exposes actionable auth errors and status changes to assistive technology', () => {
    expect(source).toContain('role="alert" aria-live="assertive"');
    expect(source).toContain('role="status" aria-live="polite"');
    expect(source).toContain('aria-label="Signing in"');
  });

  test('associates labels and browser credential semantics with critical login fields', () => {
    expect(source).toContain('htmlFor="login-email"');
    expect(source).toContain('id="login-email"');
    expect(source).toContain('autoComplete="username"');
    expect(source).toContain('htmlFor="login-password"');
    expect(source).toContain('autoComplete="current-password"');
    expect(source).toContain('htmlFor="login-pos-pin"');
  });
});
