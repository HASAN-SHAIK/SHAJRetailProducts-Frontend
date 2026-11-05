import {
  POS_PERMISSIONS,
  canAccessModule,
  canPerformPosAction,
  canReadSettings,
  isPosRestrictedRole,
  canAccessReceiptEntry,
  canAccessPaymentEntry,
  canAccessExpenseEntry,
  canAccessCashBook,
  canAccessOutstanding,
  canAccessSupplierOutstanding,
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

  test('receipt, payment and expense entry permission access matrices', () => {
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

    expect(canAccessExpenseEntry(cashier)).toBe(false);
    expect(canAccessExpenseEntry(staff)).toBe(false);
    expect(canAccessExpenseEntry(manager)).toBe(true);
    expect(canAccessExpenseEntry(admin)).toBe(true);

    // Custom permissions
    const customWriteUser = { role: 'custom', permissions: ['accounting:payment:create'] };
    expect(canAccessExpenseEntry(customWriteUser)).toBe(true);

    // Negative test: custom user with only accounting:payment:read must be denied
    const customReadOnlyUser = { role: 'custom', permissions: ['accounting:payment:read'] };
    expect(canAccessExpenseEntry(customReadOnlyUser)).toBe(false);
  });

  test('cashbook and outstanding permission access matrices', () => {
    const cashier = { role: 'cashier' };
    const staff = { role: 'staff' };
    const manager = { role: 'manager' };
    const admin = { role: 'admin' };

    // CashBook: cashier, manager, admin allowed; staff blocked
    expect(canAccessCashBook(cashier)).toBe(true);
    expect(canAccessCashBook(manager)).toBe(true);
    expect(canAccessCashBook(admin)).toBe(true);
    expect(canAccessCashBook(staff)).toBe(false);

    // Customer Outstanding: cashier, manager, admin allowed; staff blocked
    expect(canAccessOutstanding(cashier)).toBe(true);
    expect(canAccessOutstanding(manager)).toBe(true);
    expect(canAccessOutstanding(admin)).toBe(true);
    expect(canAccessOutstanding(staff)).toBe(false);

    // Supplier Outstanding: manager, admin allowed; cashier and staff blocked
    expect(canAccessSupplierOutstanding(cashier)).toBe(false);
    expect(canAccessSupplierOutstanding(staff)).toBe(false);
    expect(canAccessSupplierOutstanding(manager)).toBe(true);
    expect(canAccessSupplierOutstanding(admin)).toBe(true);
  });
});
