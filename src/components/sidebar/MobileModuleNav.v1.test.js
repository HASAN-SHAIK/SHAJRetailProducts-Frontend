import fs from 'fs';
import path from 'path';
import { getVisibleMobileModules } from './mobileModuleNavPolicy';

describe('MobileModuleNav role and permission policy', () => {
  test('staff user cannot see Accounts, Adjustments, Customers, or Sync Center', () => {
    const staffUser = { role: 'staff' };
    const visible = getVisibleMobileModules({
      user: staffUser,
      isOpeningCompleted: true,
    });

    expect(visible.accounts).toBe(false);
    expect(visible.adjustments).toBe(false);
    expect(visible.customers).toBe(false);
    expect(visible.syncCenter).toBe(false);

    // Staff can access day-to-day POS operations
    expect(visible.billing).toBe(true);
    expect(visible.orders).toBe(true);
    expect(visible.inventory).toBe(true);
  });

  test('cashier user cannot see Accounts, Adjustments, Customers, or Sync Center', () => {
    const cashierUser = { role: 'cashier' };
    const visible = getVisibleMobileModules({
      user: cashierUser,
      isOpeningCompleted: true,
    });

    expect(visible.accounts).toBe(false);
    expect(visible.adjustments).toBe(false);
    expect(visible.customers).toBe(false);
    expect(visible.syncCenter).toBe(false);

    expect(visible.billing).toBe(true);
    expect(visible.orders).toBe(true);
    expect(visible.inventory).toBe(true);
  });

  test('admin user can access all modules when opening setup is completed', () => {
    const adminUser = { role: 'admin' };
    const visible = getVisibleMobileModules({
      user: adminUser,
      isOpeningCompleted: true,
    });

    expect(visible.accounts).toBe(true);
    expect(visible.adjustments).toBe(true);
    expect(visible.customers).toBe(true);
    expect(visible.syncCenter).toBe(true);
    expect(visible.billing).toBe(true);
    expect(visible.orders).toBe(true);
    expect(visible.inventory).toBe(true);
  });

  test('modules requiring completed opening setup are hidden when opening is not completed', () => {
    const adminUser = { role: 'admin' };
    const visible = getVisibleMobileModules({
      user: adminUser,
      isOpeningCompleted: false,
    });

    expect(visible.billing).toBe(false);
    expect(visible.orders).toBe(false);
    expect(visible.adjustments).toBe(false);

    // Other non-opening dependent modules remain available
    expect(visible.inventory).toBe(true);
    expect(visible.customers).toBe(true);
    expect(visible.accounts).toBe(true);
    expect(visible.syncCenter).toBe(true);
  });

  test('MobileModuleNav source imports and uses isPosRestrictedRole and canAccessModule', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, 'MobileModuleNav.jsx'),
      'utf8'
    );
    const policySource = fs.readFileSync(
      path.resolve(__dirname, 'mobileModuleNavPolicy.js'),
      'utf8'
    );

    expect(source).toContain('isPosRestrictedRole');
    expect(source).toContain('canAccessModule');
    expect(source).toContain('isOpeningCompleted');

    expect(policySource).toContain('isPosRestrictedRole');
    expect(policySource).toContain('canAccessModule');
    expect(policySource).toContain('isOpeningCompleted');
  });
});
