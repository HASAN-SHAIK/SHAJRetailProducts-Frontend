import { SYNC_STATUS } from './constants';
import { stampSyncMetadata } from './conflictResolution';

const LOCAL_ID_PREFIXES = ['local:', 'temp:', 'tmp:', 'temp_'];

export const isLocalEntityId = (value) => {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return false;
  return LOCAL_ID_PREFIXES.some((prefix) => text.startsWith(prefix));
};

export const normalizeSyncStatus = (value, fallback = SYNC_STATUS.PENDING) => {
  const status = String(value || '').trim().toLowerCase();
  if (status === SYNC_STATUS.SYNCED || status === 'done') return SYNC_STATUS.SYNCED;
  if (status === SYNC_STATUS.PENDING || status === 'pending_sync') return SYNC_STATUS.PENDING;
  if (status === SYNC_STATUS.PROCESSING) return SYNC_STATUS.PROCESSING;
  if (status === SYNC_STATUS.FAILED || status === 'error') return SYNC_STATUS.FAILED;
  if (status === SYNC_STATUS.LOCAL) return SYNC_STATUS.LOCAL;
  return fallback;
};

export const getEntitySyncState = (record = {}) => {
  const explicit =
    record.syncStatus ??
    record.sync_status ??
    record.isSynced ??
    record.is_synced ??
    record.syncAction;
  if (record.is_offline === true || record.isOffline === true) {
    return SYNC_STATUS.PENDING;
  }
  if (isLocalEntityId(record.id ?? record.order_id ?? record.client_order_id)) {
    return SYNC_STATUS.LOCAL;
  }
  if (explicit === true) return SYNC_STATUS.SYNCED;
  if (explicit === false) return SYNC_STATUS.PENDING;
  return normalizeSyncStatus(explicit, SYNC_STATUS.SYNCED);
};

export const isEntityUnsynced = (record = {}) => {
  const state = getEntitySyncState(record);
  return state === SYNC_STATUS.PENDING || state === SYNC_STATUS.LOCAL || state === SYNC_STATUS.FAILED;
};

export const markEntityPending = (record = {}, action = 'UPDATE') => {
  return stampSyncMetadata(
    {
      ...record,
      syncStatus: SYNC_STATUS.PENDING,
      sync_status: SYNC_STATUS.PENDING,
      isSynced: false,
      is_synced: false,
      syncAction: action,
    },
    { incrementVersion: true }
  );
};

export const markEntitySynced = (record = {}) => {
  const now = new Date().toISOString();
  return {
    ...record,
    syncStatus: SYNC_STATUS.SYNCED,
    sync_status: SYNC_STATUS.SYNCED,
    isSynced: true,
    is_synced: true,
    syncAction: null,
    updatedAt: now,
    updated_at: now,
  };
};

export const markEntityFailed = (record = {}, errorMessage = '') => {
  const now = new Date().toISOString();
  return {
    ...record,
    syncStatus: SYNC_STATUS.FAILED,
    sync_status: SYNC_STATUS.FAILED,
    isSynced: false,
    is_synced: false,
    syncError: errorMessage || record.syncError || null,
    updatedAt: now,
    updated_at: now,
  };
};
