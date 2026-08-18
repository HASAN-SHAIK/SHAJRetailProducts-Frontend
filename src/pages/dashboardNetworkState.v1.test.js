const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'Dashboard.jsx'), 'utf8');

describe('V1 dashboard network state', () => {
  test('surfaces Central reachability failures instead of silently presenting stale or empty dashboard data', () => {
    expect(source).toContain('window.addEventListener("server-status", handleServerStatus)');
    expect(source).toContain('setIsDashboardOffline(event?.detail?.offline === true)');
    expect(source).toContain('Dashboard data is unavailable because Central cannot be reached.');
    expect(source).toContain('role="alert"');
    expect(source).toContain('aria-live="assertive"');
  });

  test('provides an explicit retry that remounts the dashboard request surface', () => {
    expect(source).toContain('const retryDashboard = () => {');
    expect(source).toContain('setDashboardRetryKey((current) => current + 1);');
    expect(source).toContain('Retry dashboard');
    expect(source).toContain('<DashboardOverview key={dashboardRetryKey} navigate={navigate}/>');
  });
});
