export const canAccessSyncCenter = (userDetails) =>
  String(userDetails?.role || '').trim().toLowerCase() === 'admin';
