/**
 * Offline-first architecture constants.
 * Shared by desktop local store, operation queue, and future sync engine.
 */

export const SYNC_STATUS = Object.freeze({
  SYNCED: 'synced',
  PENDING: 'pending',
  PROCESSING: 'processing',
  FAILED: 'failed',
  LOCAL: 'local',
});

export const OPERATION_ACTION = Object.freeze({
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
});

export const OFFLINE_MODULE = Object.freeze({
  SALES: 'sales',
  INVENTORY: 'inventory',
  PURCHASES: 'purchases',
  CUSTOMERS: 'customers',
  SUPPLIERS: 'suppliers',
  PRODUCTS: 'products',
  STAFF: 'staff',
  EXPENSES: 'expenses',
  RETURNS: 'returns',
  GST: 'gst',
  ACCOUNTS: 'accounts',
  SETTINGS: 'settings',
});

export const QUEUE_PRIORITY = Object.freeze({
  CRITICAL: 1,
  HIGH: 2,
  NORMAL: 3,
  LOW: 4,
});

export const OFFLINE_EVENTS = Object.freeze({
  OPERATION_QUEUED: 'offline-operation-queued',
  OPERATION_UPDATED: 'offline-operation-updated',
  STATE_CHANGED: 'offline-state-changed',
  QUEUE_UPDATED: 'offline-queue-updated',
});

/**
 * Desktop-first modules that must remain usable offline.
 * SQL is the system of record once synchronized; IndexedDB is the local working set.
 */
export const OFFLINE_FIRST_MODULES = Object.freeze([
  OFFLINE_MODULE.SALES,
  OFFLINE_MODULE.INVENTORY,
  OFFLINE_MODULE.PURCHASES,
  OFFLINE_MODULE.CUSTOMERS,
  OFFLINE_MODULE.SUPPLIERS,
  OFFLINE_MODULE.PRODUCTS,
  OFFLINE_MODULE.STAFF,
  OFFLINE_MODULE.EXPENSES,
  OFFLINE_MODULE.RETURNS,
  OFFLINE_MODULE.GST,
  OFFLINE_MODULE.ACCOUNTS,
]);
