const SCREEN_ROUTES = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Orders', path: '/orders' },
  { name: 'Retail Billing', path: '/billing/retail' },
  { name: 'Wholesale Billing', path: '/billing/wholesale' },
  { name: 'Inventory Catalog', path: '/inventory/catalog' },
  { name: 'Purchase', path: '/inventory/purchase' },
  { name: 'Purchase Book', path: '/inventory/purchases' },
  { name: 'Purchase Returns', path: '/inventory/purchase-returns' },
  { name: 'Suppliers', path: '/inventory/suppliers' },
  { name: 'Customers', path: '/customers' },
  { name: 'Staff List', path: '/staff-expenses/staff/list' },
  { name: 'Salary Tracking', path: '/staff-expenses/staff/salary' },
  { name: 'Expense Add', path: '/staff-expenses/expenses/add' },
  { name: 'Receipt Entry', path: '/accounts/receipt' },
  { name: 'Payment Entry', path: '/accounts/payment' },
  { name: 'Cash Book', path: '/accounts/cashbook' },
  { name: 'Bank Book', path: '/accounts/bankbook' },
  { name: 'Ledger', path: '/accounts/ledger' },
  { name: 'Outstanding', path: '/accounts/outstanding' },
  { name: 'Returns History', path: '/returns-corrections/returns/history' },
  { name: 'Correction History', path: '/returns-corrections/corrections/history' },
  { name: 'Tax Reports', path: '/returns-corrections/gst/reports' },
  { name: 'Sync Center', path: '/sync-center' },
];

describe('Smoke - Screen Accessibility', () => {
  beforeEach(() => {
    cy.loginAndOpen('/dashboard');
  });

  SCREEN_ROUTES.forEach((screen) => {
    it(`loads ${screen.name}`, () => {
      cy.visit(screen.path);
      cy.location('pathname', { timeout: 30000 }).should('include', screen.path);
      cy.get('body').should('be.visible');
    });
  });
});
