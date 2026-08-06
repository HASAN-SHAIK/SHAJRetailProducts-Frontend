import { isOnline } from '../utils/apiClient';

/**
 * Desktop offline-first policy helpers.
 * Read/write decisions only — no synchronization is performed here.
 */

export const canReachServer = () => {
  if (!isOnline()) return false;
  if (typeof window !== 'undefined' && window.__serverOffline === true) return false;
  return true;
};

export const shouldUseLocalStore = () => true;

export const shouldQueueForSync = ({ forceQueue = false, isLocalEntity = false } = {}) => {
  if (forceQueue) return true;
  if (!canReachServer()) return true;
  if (isLocalEntity) return true;
  return false;
};

export const resolveDataSource = () => {
  if (canReachServer()) return 'hybrid';
  return 'local';
};

export const assertOfflineCapable = (moduleName) => {
  if (!moduleName) return true;
  return true;
};
