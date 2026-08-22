const fs = require('fs');
const path = require('path');

const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');

describe('V1 POS staff management retirement', () => {
  test.each(['StaffList.jsx', 'StaffForm.jsx', 'SalaryTracking.jsx'])(
    '%s redirects management authority out of POS',
    (name) => {
      const source = read(name);
      expect(source).toContain('Navigate');
      expect(source).toContain('/billing/retail');
      expect(source).not.toMatch(/api\.(get|post|put|patch|delete)/);
      expect(source).not.toMatch(/["'`]\/staff|["'`]\/salary/);
    }
  );
});
