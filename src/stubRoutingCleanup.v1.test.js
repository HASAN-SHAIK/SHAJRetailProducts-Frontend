const fs = require('fs');
const path = require('path');

const read = (rel) => fs.readFileSync(path.join(__dirname, rel), 'utf8');
const app = read('App.js')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

const routeLine = (p) => app.split('\n').find((l) => l.includes(`path="${p}"`)) || '';

describe('POS retired-stub routing contract', () => {
  test.each([
    ['/staff-expenses/expenses/add', 'ExpenseAdd'],
    ['/accounts/bankbook', 'BankBook'],
    ['/accounts/ledger', 'Ledger'],
    ['/customers/reorder', 'CustomerReorder'],
  ])('%s stays routed to the %s redirect stub (guarded by retirement tests)', (route, comp) => {
    expect(routeLine(route)).toContain(`<${comp} />`);
    expect(app).toContain(`import ${comp} from`);
  });

  test('stub screens are pure redirects to /billing/retail', () => {
    [
      'pages/staffExpenses/ExpenseAdd.jsx',
      'pages/accounts/BankBook.jsx',
      'pages/accounts/Ledger.jsx',
      'pages/customers/CustomerReorder.jsx',
    ].forEach((f) => {
      const s = read(f);
      expect(s).toContain('<Navigate to="/billing/retail" replace />');
      expect(s).not.toMatch(/api\.|useEffect/);
    });
  });

  test('/accounts/expense is the working expense screen', () => {
    expect(routeLine('/accounts/expense')).toContain('ExpenseEntry');
  });

  test('opening setup is a gated RetailHub handoff, not a stub', () => {
    const line = app.split('\n').find((l) => l.includes('<OpeningSetup />')) || '';
    expect(line).toContain('isOpeningCompleted');
  });

  test('orphaned Payment component folder is removed and PhonePe stays unreferenced', () => {
    expect(fs.existsSync(path.join(__dirname, 'components/Payment'))).toBe(false);
    expect(read('App.js')).not.toMatch(/PhonePe|QRCodeModal|PaymentForm/);
  });
});
