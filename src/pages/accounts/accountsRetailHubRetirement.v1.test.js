const fs = require('fs');
const path = require('path');

const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');

describe('V1 POS accounts management retirement and active accounting routes', () => {
  // CashBook, BankBook, Ledger, and Outstanding remain retired from POS to RetailHub
  test.each(['CashBook.jsx', 'BankBook.jsx', 'Ledger.jsx', 'Outstanding.jsx'])(
    '%s redirects accounting management out of POS',
    (name) => {
      const source = read(name);
      expect(source).toContain('Navigate');
      expect(source).toContain('/billing/retail');
      expect(source).not.toMatch(/api\.(get|post|put|patch|delete)/);
      expect(source).not.toMatch(/\/accounts\//);
    }
  );

  test('ReceiptEntry.jsx is an active POS operational receipt component with role and online guards', () => {
    const source = read('ReceiptEntry.jsx');
    expect(source).toContain('canAccessReceiptEntry');
    expect(source).toContain('createReceipt');
    expect(source).toContain('Offline Mode');
    expect(source).toContain('Navigate to="/billing/retail"');
  });

  test('PaymentEntry.jsx is an active POS operational payment component with role and online guards', () => {
    const source = read('PaymentEntry.jsx');
    expect(source).toContain('canAccessPaymentEntry');
    expect(source).toContain('createPayment');
    expect(source).toContain('Offline Mode');
    expect(source).toContain('Navigate to="/billing/retail"');
  });

  test('OpeningSetup remains in POS until startup handoff is decoupled', () => {
    const openingSetup = read('OpeningSetup.jsx');
    expect(openingSetup).not.toContain('Navigate to="/billing/retail"');
  });
});
