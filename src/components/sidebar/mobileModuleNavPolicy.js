import {
  canAccessModule,
  canAccessReceiptEntry,
  getStoredSessionUser,
  isPosRestrictedRole,
} from '../../utils/permissions';

export const getVisibleMobileModules = ({
  user = null,
  isOpeningCompleted = true,
} = {}) => {
  const isStaff = isPosRestrictedRole(user);
  const role = String(user?.role || '').toLowerCase();
  const isAdmin =
    role === 'admin' ||
    (Array.isArray(user?.permissions) && user.permissions.includes('*'));

  const canViewCustomers =
    !isStaff &&
    (isAdmin ||
      canAccessModule(user, 'customers') ||
      canAccessModule(getStoredSessionUser(), 'customers'));
  const canViewAdjustments = Boolean(isOpeningCompleted && !isStaff);
  const canViewAccounts =
    !isStaff &&
    (isAdmin ||
      canAccessModule(user, 'accounts') ||
      canAccessReceiptEntry(user));
  const canViewSyncCenter = !isStaff;
  const canViewBilling = Boolean(isOpeningCompleted);
  const canViewOrders = Boolean(isOpeningCompleted);
  const canViewInventory = true;

  return {
    billing: canViewBilling,
    orders: canViewOrders,
    inventory: canViewInventory,
    customers: canViewCustomers,
    accounts: canViewAccounts,
    adjustments: canViewAdjustments,
    syncCenter: canViewSyncCenter,
  };
};
