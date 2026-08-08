export const POS_PERMISSIONS = Object.freeze({
  SALE: 'pos:sale',
  DISCOUNT: 'pos:discount',
  VOID: 'pos:void',
  REFUND: 'pos:refund',
  APPROVE: 'pos:approve',
});

export const MODULE_PERMISSIONS = {
  // orders:* stays as a temporary compatibility path for previously issued
  // sessions; new cashier/manager grants use explicit pos:* capabilities.
  pos: [POS_PERMISSIONS.SALE, 'orders:read', 'orders:write'],
  customers: ['customers:read'],
  inventory: ['inventory:read', 'products:read'],
  purchase: ['suppliers:read', 'suppliers:write'],
  accounts: ['expenses:read', 'expenses:write'],
  reports: ['reports:read'],
  settings: ['settings:read'],
};

const normalizePermissions = (userOrPermissions) => {
  if (Array.isArray(userOrPermissions)) return userOrPermissions;
  if (Array.isArray(userOrPermissions?.permissions)) return userOrPermissions.permissions;
  return [];
};

export const hasPermission = (userOrPermissions, permission) => {
  const permissions = normalizePermissions(userOrPermissions);
  return permissions.includes('*') || permissions.includes(permission);
};

export const hasAnyPermission = (userOrPermissions, required = []) => {
  const permissions = normalizePermissions(userOrPermissions);
  if (permissions.includes('*')) return true;
  return required.some((permission) => permissions.includes(permission));
};

export const canPerformPosAction = (userOrPermissions, action) => {
  const permission = POS_PERMISSIONS[String(action || '').toUpperCase()];
  if (!permission) return false;
  return hasPermission(userOrPermissions, permission);
};

export const canAccessModule = (user, moduleName) => {
  if (!user) return false;
  const required = MODULE_PERMISSIONS[moduleName] || [];
  if (!required.length) return true;
  return hasAnyPermission(user, required);
};

export const enrichUserPermissions = (user, permissions = [], storePermissions = null) => {
  if (!user) return user;
  return {
    ...user,
    permissions: Array.isArray(permissions) && permissions.length
      ? permissions
      : Array.isArray(user.permissions)
        ? user.permissions
        : [],
    store_permissions: storePermissions || user.store_permissions || null,
  };
};
