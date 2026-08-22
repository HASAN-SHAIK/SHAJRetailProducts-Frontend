const fs = require('fs');
const path = require('path');

describe('RetailHub dashboard migration boundary', () => {
  const dashboard = fs.readFileSync(path.join(__dirname, 'Dashboard.jsx'), 'utf8');
  const operational = fs.readFileSync(path.join(__dirname, '../components/Dashboard/POSOperationalDashboard.jsx'), 'utf8');

  test('POS dashboard no longer renders the management analytics dashboard', () => {
    expect(dashboard).toContain('POSOperationalDashboard');
    expect(dashboard).not.toContain('DashboardOverview');
    expect(dashboard).not.toContain('/dashboard/revenue-overview');
    expect(dashboard).not.toContain('/dashboard/growth-comparison');
  });

  test('POS retains only local operational authority and points analytics to Retail Hub', () => {
    expect(operational).toContain('localPosHealth');
    expect(operational).toContain("localPosRequest('/diagnostics')");
    expect(operational).toContain('Open Sync Center');
    expect(operational).toContain('Business analytics now live in SHAJ Retail Hub');
    expect(operational).not.toContain('/dashboard/revenue-overview');
    expect(operational).not.toContain('/dashboard/smart-insights');
    expect(operational).not.toContain('fetchInventoryIntelligence');
  });
});
