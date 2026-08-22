const fs = require('fs');
const path = require('path');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, relativePath), 'utf8');

describe('POS Staff management retirement boundary', () => {
  test.each([
    'pages/staffExpenses/StaffList.jsx',
    'pages/staffExpenses/StaffForm.jsx',
    'pages/staffExpenses/SalaryTracking.jsx',
  ])('%s redirects to billing and contains no staff management authority', (file) => {
    const source = read(file);
    expect(source).toContain('Navigate');
    expect(source).toContain('/billing/retail');
    expect(source).not.toMatch(/getLocalStaff|upsertLocalStaff|getLocalSalaries|upsertLocalSalary|saveConfigValue|getStaffExpenseTotal/);
  });

  test('operator runtime identity and permission logic remains in App', () => {
    const app = read('App.js');
    expect(app).toContain('userDetails');
    expect(app).toContain("String(userDetails?.role || '').toLowerCase()");
  });
});
