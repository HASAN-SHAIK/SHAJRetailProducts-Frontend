const fs = require('fs');
const path = require('path');

const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');

describe('V1 POS expense management retirement', () => {
  test.each(['ExpenseAdd.jsx', 'ExpenseDailyReport.jsx', 'ExpenseMonthlyReport.jsx', 'ExpenseStaffReport.jsx'])(
    '%s redirects finance management out of POS',
    (name) => {
      const source = read(name);
      expect(source).toContain('Navigate');
      expect(source).toContain('/billing/retail');
      expect(source).not.toMatch(/api\.(get|post|put|patch|delete)/);
      expect(source).not.toMatch(/\/expenses/);
    }
  );
});
