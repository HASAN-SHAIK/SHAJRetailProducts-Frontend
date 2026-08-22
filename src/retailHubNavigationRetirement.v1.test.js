const fs = require('fs');
const path = require('path');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, relativePath), 'utf8');

describe('RetailHub POS management navigation retirement', () => {
  test('POS navbar does not advertise migrated management domains', () => {
    const navbar = read('components/common/Navbar/Navbar.js');

    expect(navbar).not.toContain("navigateTo('/customers')");
    expect(navbar).not.toContain("navigateTo('/staff-expenses/staff/list')");
    expect(navbar).not.toContain("navigateTo('/accounts/receipt')");
    expect(navbar).not.toContain('Staff & Expenses');
    expect(navbar).not.toContain('>Customers<');
    expect(navbar).not.toContain('>Accounts<');
  });

  test('POS navbar preserves execution and edge navigation', () => {
    const navbar = read('components/common/Navbar/Navbar.js');

    expect(navbar).toContain("navigateTo('/billing/retail')");
    expect(navbar).toContain("navigateTo('/inventory/catalog')");
    expect(navbar).toContain("navigateTo('/returns-corrections/returns/new')");
    expect(navbar).toContain("navigateTo('/sync-center')");
  });

  test('opening setup remains only a RetailHub handoff target while incomplete', () => {
    const navbar = read('components/common/Navbar/Navbar.js');
    const openingSetup = read('pages/accounts/OpeningSetup.js');

    expect(navbar).toContain("navigateTo('/accounts/opening-setup')");
    expect(openingSetup).toContain('REACT_APP_RETAIL_HUB_URL');
    expect(openingSetup).not.toMatch(/api\.(get|post|put|patch|delete)\(['\"]\/accounts\//);
  });
});
