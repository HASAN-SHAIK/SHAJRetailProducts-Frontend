export const MODULE_PERMISSIONS = {
  pos: ['orders:read', 'orders:write'],
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
