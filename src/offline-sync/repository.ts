import type { Table } from 'dexie';
import { offlineSyncDb, generateId, nowIso } from './db';
import { addToQueue } from './queue';
import type { SyncEntityName, SyncOperation, SyncableEntity } from './types';

interface RepositoryConfig<TEntity extends SyncableEntity> {
  entity: SyncEntityName;
  table: Table<TEntity, string>;
}

const applySyncDefaults = <TEntity extends Partial<SyncableEntity>>(
  input: TEntity
): TEntity & SyncableEntity => {
  const now = nowIso();
  const id = String(input.id || generateId());
  return {
    ...(input as Record<string, unknown>),
    id,
    syncStatus: 'pending',
    lastSyncedAt: null,
    createdAt: input.createdAt || now,
    updatedAt: now,
  } as TEntity & SyncableEntity;
};

const ensureExists = async <TEntity extends SyncableEntity>(
  table: Table<TEntity, string>,
  id: string
): Promise<TEntity> => {
  const entity = await table.get(id);
  if (!entity) {
    throw new Error(`Entity not found for id: ${id}`);
  }
  return entity;
};

export const createOfflineRepository = <TEntity extends SyncableEntity>(
  config: RepositoryConfig<TEntity>
) => {
  const { entity, table } = config;

  const enqueue = async (operation: SyncOperation, payload: unknown, entityId: string): Promise<void> => {
    await addToQueue(entity, operation, payload, entityId);
  };

  return {
    create: async (payload: Partial<TEntity>): Promise<TEntity> => {
      const prepared = applySyncDefaults(payload) as TEntity;
      await offlineSyncDb.transaction('rw', table, offlineSyncDb.sync_queue, async () => {
        await table.put(prepared);
        await enqueue('create', prepared, prepared.id);
      });
      return prepared;
    },

    update: async (id: string, patch: Partial<TEntity>): Promise<TEntity> => {
      const existing = await ensureExists(table, id);
      const updated: TEntity = {
        ...existing,
        ...patch,
        id,
        syncStatus: 'pending',
        lastSyncedAt: existing.lastSyncedAt ?? null,
        updatedAt: nowIso(),
      };

      await offlineSyncDb.transaction('rw', table, offlineSyncDb.sync_queue, async () => {
        await table.put(updated);
        await enqueue('update', updated, id);
      });

      return updated;
    },

    remove: async (id: string): Promise<void> => {
      const existing = await ensureExists(table, id);
      const tombstone: TEntity = {
        ...existing,
        syncStatus: 'pending',
        updatedAt: nowIso(),
        deletedAt: nowIso(),
      };

      await offlineSyncDb.transaction('rw', table, offlineSyncDb.sync_queue, async () => {
        await table.put(tombstone);
        await enqueue('delete', { id }, id);
      });
    },

    getById: async (id: string): Promise<TEntity | undefined> => table.get(id),

    list: async (): Promise<TEntity[]> => table.toArray(),
  };
};

export const productRepository = createOfflineRepository({
  entity: 'product',
  table: offlineSyncDb.products,
});

export const invoiceRepository = createOfflineRepository({
  entity: 'invoice',
  table: offlineSyncDb.invoices,
});

export const customerRepository = createOfflineRepository({
  entity: 'customer',
  table: offlineSyncDb.customers,
});
