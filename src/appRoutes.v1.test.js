const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'App.js'), 'utf8');
const activeSource = source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

const activeRoutePaths = Array.from(
  activeSource.matchAll(/<Route\s+[^>]*path=["']([^"']+)["']/g),
  (match) => match[1]
);

const expectRoute = (route) => expect(activeRoutePaths).toContain(route);

const EXPECTED_V1_ROUTES = [
  '/',
  '/setup',
  '/subscription-expired',
  '/dashboard',
  '/billing/retail',
  '/billing/wholesale',
  '/orders/sales',
  '/orders/purchases',
  '/inventory/catalog',
  '/inventory/purchase',
  '/inventory/purchases',
  '/inventory/purchase-returns',
  '/inventory/suppliers',
  '/customers',
  '/customers/new',
  '/customers/:id',
  '/customers/:id/edit',
  '/returns-corrections/returns/new',
  '/returns-corrections/returns/history',
  '/accounts/receipt',
  '/accounts/payment',
  '/accounts/cashbook',
  '/accounts/bankbook',
  '/accounts/ledger',
  '/accounts/outstanding',
  '/sync-center',
  '/branch-devices',
  '/support',
  '/logout',
  '/m/dashboard',
  '/m/orders',
  '/m/neworder',
  '/m/products',
  '/m/reports',
  '/m/settings',
];

describe('V1 frontend routed screen inventory', () => {
  test('keeps the accepted V1 cashier/admin route families explicitly reachable', () => {
    EXPECTED_V1_ROUTES.forEach(expectRoute);
  });

  test('keeps compatibility aliases as redirects instead of duplicate screens', () => {
    expectRoute('/login');
    expectRoute('/products');
    expectRoute('/billing');
    expectRoute('/orders');
    expectRoute('/inventory');
    expectRoute('/staff-expenses');
    expectRoute('/returns-corrections');
    expectRoute('/accounts');
  });

  test('does not reactivate deferred or removed public V1 entry points', () => {
    expect(activeRoutePaths).not.toContain('/register');
    expect(activeRoutePaths).not.toContain('/transactions');
    expect(activeRoutePaths).not.toContain('/billing-new');
  });

  test('retains the authenticated fallback boundary for unknown routes', () => {
    expect(activeSource).toContain(
      '<Route path="*" element={userDetails ? <Navigate to="/dashboard" replace /> : <Navigate to="/" replace />} />'
    );
  });
});
