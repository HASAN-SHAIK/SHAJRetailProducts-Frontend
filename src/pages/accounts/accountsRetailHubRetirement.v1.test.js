const fs = require('fs');
const path = require('path');

const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');

describe('V1 POS accounts management retirement', () => {
  test.each(['ReceiptEntry.jsx', 'PaymentEntry.jsx', 'CashBook.jsx', 'BankBook.jsx', 'Ledger.jsx', 'Outstanding.jsx'])(
    '%s redirects accounting management out of POS',
    (name) => {
      const source = read(name);
      expect(source).toContain('Navigate');
      expect(source).toContain('/billing/retail');
      expect(source).not.toMatch(/api\.(get|post|put|patch|delete)/);
      expect(source).not.toMatch(/\/accounts\//);
    }
  );

  test('OpeningSetup remains in POS until startup handoff is decoupled', () => {
    const openingSetup = read('OpeningSetup.jsx');
    expect(openingSetup).not.toContain('Navigate to="/billing/retail"');
  });
});
