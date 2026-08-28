import {
  POS_PERMISSIONS,
  canAccessModule,
  canPerformPosAction,
  canReadSettings,
  isPosRestrictedRole,
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
});
