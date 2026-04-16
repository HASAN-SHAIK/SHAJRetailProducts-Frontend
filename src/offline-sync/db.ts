import Dexie, { type Table } from 'dexie';
import type { SyncQueueItem, SyncableEntity } from './types';

export class OfflineSyncDb extends Dexie {
  sync_queue!: Table<SyncQueueItem, string>;
  products!: Table<SyncableEntity, string>;
  invoices!: Table<SyncableEntity, string>;
  customers!: Table<SyncableEntity, string>;

  constructor() {
    super('shajretaildb_offline_sync');

    this.version(1).stores({
      sync_queue:
        'id, entity, entityId, operation, status, retryCount, nextRetryAt, createdAt, updatedAt',
      products: 'id, syncStatus, lastSyncedAt, updatedAt, deletedAt',
      invoices: 'id, syncStatus, lastSyncedAt, updatedAt, deletedAt',
      customers: 'id, syncStatus, lastSyncedAt, updatedAt, deletedAt',
    });
  }
}

export const offlineSyncDb = new OfflineSyncDb();

export const nowIso = (): string => new Date().toISOString();

export const generateId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `local:${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};
