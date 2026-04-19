import type { Table } from 'dexie';
import { offlineSyncDb, generateId, nowIso } from './db';
import type {
  SyncEntityName,
  SyncHandlerMap,
  SyncOperation,
  SyncQueueItem,
  SyncWorkerOptions,
  SyncableEntity,
} from './types';

const DEFAULT_OPTIONS: Required<SyncWorkerOptions> = {
  batchSize: 25,
  maxRetries: 6,
  baseBackoffMs: 1000,
  maxBackoffMs: 5 * 60 * 1000,
  intervalMs: 10_000,
};

let workerTimer: ReturnType<typeof setInterval> | null = null;
let workerInFlight = false;

const safeError = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  return 'Unknown sync error';
};

const getBackoffMs = (
  retryCount: number,
  baseBackoffMs: number,
  maxBackoffMs: number
): number => {
  const attempt = Math.max(0, retryCount);
  const exponential = baseBackoffMs * Math.pow(2, attempt);
  return Math.min(exponential, maxBackoffMs);
};

const shouldAttempt = (item: SyncQueueItem, now: Date): boolean => {
  if (item.status === 'pending') return true;
  if (item.status !== 'failed') return false;
  if (!item.nextRetryAt) return true;
  return new Date(item.nextRetryAt).getTime() <= now.getTime();
};

const updateEntitySyncState = async (
  entityTable: Table<SyncableEntity, string>,
  entityId: string,
  updates: Partial<SyncableEntity>
): Promise<void> => {
  const existing = await entityTable.get(entityId);
  if (!existing) return;
  await entityTable.put({ ...existing, ...updates, updatedAt: nowIso() });
};

export const addToQueue = async <TPayload>(
  entity: SyncEntityName,
  operation: SyncOperation,
  payload: TPayload,
  entityId: string
): Promise<SyncQueueItem<TPayload>> => {
  const now = nowIso();
  const queueItem: SyncQueueItem<TPayload> = {
    id: generateId(),
    entity,
    entityId,
    operation,
    payload,
    status: 'pending',
    retryCount: 0,
    nextRetryAt: null,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  };

  await offlineSyncDb.sync_queue.put(queueItem as SyncQueueItem);
  return queueItem;
};

const getEntityTable = (entity: SyncEntityName): Table<SyncableEntity, string> => {
  switch (entity) {
    case 'product':
      return offlineSyncDb.products;
    case 'invoice':
      return offlineSyncDb.invoices;
    case 'customer':
      return offlineSyncDb.customers;
    default:
      throw new Error(`No local table mapping configured for entity: ${entity}`);
  }
};

const markQueueItem = async (
  item: SyncQueueItem,
  updates: Partial<SyncQueueItem>
): Promise<SyncQueueItem> => {
  const next: SyncQueueItem = {
    ...item,
    ...updates,
    updatedAt: nowIso(),
  };
  await offlineSyncDb.sync_queue.put(next);
  return next;
};

export const runSyncWorker = async (
  handlers: SyncHandlerMap,
  options: SyncWorkerOptions = {}
): Promise<{ processed: number; failed: number }> => {
  if (workerInFlight || !navigator.onLine) {
    return { processed: 0, failed: 0 };
  }

  workerInFlight = true;
  const cfg = { ...DEFAULT_OPTIONS, ...options };
  const now = new Date();
  let processed = 0;
  let failed = 0;

  try {
    const all = await offlineSyncDb.sync_queue.toArray();
    const candidates = all
      .filter((item) => shouldAttempt(item, now))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(0, cfg.batchSize);

    for (const item of candidates) {
      const handler = handlers[item.entity]?.[item.operation];
      if (!handler) {
        failed += 1;
        await markQueueItem(item, {
          status: 'failed',
          retryCount: item.retryCount + 1,
          nextRetryAt: new Date(Date.now() + getBackoffMs(item.retryCount + 1, cfg.baseBackoffMs, cfg.maxBackoffMs)).toISOString(),
          lastError: `Missing sync handler for ${item.entity}:${item.operation}`,
        });
        continue;
      }

      await markQueueItem(item, { status: 'syncing', lastError: null });

      try {
        await handler({ queueItem: item });

        await markQueueItem(item, {
          status: 'success',
          nextRetryAt: null,
          lastError: null,
        });

        const entityTable = getEntityTable(item.entity);
        await updateEntitySyncState(entityTable, item.entityId, {
          syncStatus: 'synced',
          lastSyncedAt: nowIso(),
        });

        processed += 1;
      } catch (error) {
        const retries = item.retryCount + 1;
        const exhausted = retries > cfg.maxRetries;

        await markQueueItem(item, {
          status: 'failed',
          retryCount: retries,
          nextRetryAt: exhausted
            ? null
            : new Date(Date.now() + getBackoffMs(retries, cfg.baseBackoffMs, cfg.maxBackoffMs)).toISOString(),
          lastError: safeError(error),
        });

        try {
          const entityTable = getEntityTable(item.entity);
          await updateEntitySyncState(entityTable, item.entityId, {
            syncStatus: 'failed',
          });
        } catch {
          // Keep queue state as source of truth even if local entity update fails.
        }

        failed += 1;
      }
    }
  } finally {
    workerInFlight = false;
  }

  return { processed, failed };
};

export const startSyncWorker = (
  handlers: SyncHandlerMap,
  options: SyncWorkerOptions = {}
): void => {
  const cfg = { ...DEFAULT_OPTIONS, ...options };
  if (workerTimer) return;

  const tick = () => {
    runSyncWorker(handlers, cfg).catch(() => {
      // Swallow in interval loop; errors are tracked per queue row.
    });
  };

  tick();
  workerTimer = setInterval(tick, cfg.intervalMs);
};

export const stopSyncWorker = (): void => {
  if (!workerTimer) return;
  clearInterval(workerTimer);
  workerTimer = null;
};
