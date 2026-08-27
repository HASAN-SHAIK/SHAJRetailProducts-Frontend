const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'CustomerList.jsx'), 'utf8');

describe('RetailHub-owned customer management screen', () => {
  test('POS list route no longer exposes management loading/edit states', () => {
    expect(source).toContain('Navigate');
    expect(source).toContain('to="/billing/retail"');
    expect(source).not.toContain('Loading customers...');
    expect(source).not.toContain('Edit customer');
    expect(source).not.toContain('searchCustomers(');
  });
});
