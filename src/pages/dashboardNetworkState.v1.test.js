const fs = require('fs');
const path = require('path');

const dashboard = fs.readFileSync(path.join(__dirname, 'Dashboard.jsx'), 'utf8');
const operational = fs.readFileSync(
  path.join(__dirname, '../components/Dashboard/POSOperationalDashboard.jsx'),
  'utf8'
);

describe('V1 dashboard network state', () => {
  test('keeps the routed POS dashboard on local operational authority', () => {
    expect(dashboard).toContain('POSOperationalDashboard');
    expect(dashboard).not.toContain('DashboardOverview');
    expect(operational).toContain('localPosHealth()');
    expect(operational).toContain("localPosRequest('/diagnostics')");
    expect(operational).not.toContain('/dashboard/revenue-overview');
    expect(operational).not.toContain('/dashboard/growth-comparison');
  });

  test('surfaces local POS unavailability and provides an explicit retry', () => {
    expect(operational).toContain('POSService is unavailable. Start the local service and retry.');
    expect(operational).toContain('role="alert"');
    expect(operational).toContain('const refresh = async () => {');
    expect(operational).toContain('onClick={refresh}');
    expect(operational).toContain("state.loading ? 'Checking…' : 'Refresh POS'");
  });
});
