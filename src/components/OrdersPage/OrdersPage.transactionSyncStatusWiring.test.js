const fs = require('fs');
const path = require('path');

describe('Orders drawer transaction sync status wiring', () => {
  const source = fs.readFileSync(path.join(__dirname, 'OrdersPage.js'), 'utf8');

  test('renders the read-only POS reconciliation status for the selected order', () => {
    expect(source).toContain("import TransactionSyncStatus from './TransactionSyncStatus';");
    expect(source).toMatch(
      /<TransactionSyncStatus\s+orderId=\{drawerOrder\.id\}\s+enabled=\{isLocalPosEnabled\(\)\}\s*\/>/
    );
  });

  test('keeps the status inside the selected-order drawer before payment actions', () => {
    const drawerStart = source.indexOf('{drawerOpen && (');
    const status = source.indexOf('<TransactionSyncStatus', drawerStart);
    const paymentSummary = source.indexOf('<h4>Payment Summary</h4>', drawerStart);
    const actions = source.indexOf('<section className="drawer-section actions">', drawerStart);

    expect(drawerStart).toBeGreaterThanOrEqual(0);
    expect(status).toBeGreaterThan(drawerStart);
    expect(paymentSummary).toBeGreaterThan(status);
    expect(actions).toBeGreaterThan(paymentSummary);
  });
});
