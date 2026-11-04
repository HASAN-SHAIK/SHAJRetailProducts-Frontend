import {
  POS_PERMISSIONS,
  canAccessModule,
  canPerformPosAction,
  canReadSettings,
  isPosRestrictedRole,
  canAccessReceiptEntry,
  canAccessPaymentEntry,
} from './permissions';

describe('POS capability helpers', () => {
  test('cashier-style permissions can access POS and sell', () => {
    const user = { permissions: [POS_PERMISSIONS.SALE, 'orders:read'] };
    expect(canAccessModule(user, 'pos')).toBe(true);
    expect(canPerformPosAction(user, 'sale')).toBe(true);
    expect(canPerformPosAction(user, 'discount')).toBe(false);
  });

  test('manager-style permissions expose sensitive actions', () => {
    const user = { permissions: [
      POS_PERMISSIONS.SALE,
      POS_PERMISSIONS.DISCOUNT,
      POS_PERMISSIONS.VOID,
      POS_PERMISSIONS.REFUND,
      POS_PERMISSIONS.APPROVE,
    ] };
    expect(canPerformPosAction(user, 'discount')).toBe(true);
    expect(canPerformPosAction(user, 'void')).toBe(true);
    expect(canPerformPosAction(user, 'refund')).toBe(true);
    expect(canPerformPosAction(user, 'approve')).toBe(true);
  });

  test('legacy order permissions keep POS module visible during migration', () => {
    expect(canAccessModule({ permissions: ['orders:write'] }, 'pos')).toBe(true);
  });

  test('cashier remains POS-restricted and cannot read settings', () => {
    const user = { role: 'cashier', permissions: [POS_PERMISSIONS.SALE, 'orders:read'] };
    expect(isPosRestrictedRole(user)).toBe(true);
    expect(canReadSettings(user)).toBe(false);
  });

  test('receipt and payment entry permission access matrices', () => {
    const cashier = { role: 'cashier' };
    const staff = { role: 'staff' };
    const manager = { role: 'manager' };
    const admin = { role: 'admin' };

    expect(canAccessReceiptEntry(cashier)).toBe(true);
    expect(canAccessReceiptEntry(manager)).toBe(true);
    expect(canAccessReceiptEntry(admin)).toBe(true);
    expect(canAccessReceiptEntry(staff)).toBe(false);

    expect(canAccessPaymentEntry(cashier)).toBe(false);
    expect(canAccessPaymentEntry(staff)).toBe(false);
    expect(canAccessPaymentEntry(manager)).toBe(true);
    expect(canAccessPaymentEntry(admin)).toBe(true);
  });
});
