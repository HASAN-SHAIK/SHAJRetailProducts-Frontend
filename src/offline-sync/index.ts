import type {
  SyncEntityName,
  SyncHandlerMap,
  SyncOperation,
  SyncQueueItem,
  SyncWorkerOptions,
  SyncableEntity,
} from './types';

export * from './types';
export * from './defaultHandlers';

export type TableLike<TEntity> = {
  get: (id: string) => Promise<TEntity | undefined>;
  put: (value: TEntity) => Promise<unknown>;
  toArray: () => Promise<TEntity[]>;
};

const emptyTable = <TEntity>(): TableLike<TEntity> => ({
  get: async () => undefined,
  put: async (value) => value,
  toArray: async () => [],
});

export class OfflineSyncDb {
  name = 'sqlite_authoritative_offline_sync_disabled';
  sync_queue = emptyTable<SyncQueueItem>();
  products = emptyTable<SyncableEntity>();
  invoices = emptyTable<SyncableEntity>();
  customers = emptyTable<SyncableEntity>();

  transaction = async <TResult>(...args: unknown[]): Promise<TResult | undefined> => {
    const callback = args.find((arg): arg is () => Promise<TResult> | TResult => typeof arg === 'function');
    if (!callback) return undefined;
    return await callback();
  };
}

export const offlineSyncDb = new OfflineSyncDb();

export const nowIso = (): string => new Date().toISOString();

export const generateId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `local:${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const addToQueue = async <TPayload>(
  entity: SyncEntityName,
  operation: SyncOperation,
  payload: TPayload,
  entityId: string
): Promise<SyncQueueItem<TPayload>> => {
  const now = nowIso();
  return {
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
};

export const runSyncWorker = async (
  _handlers: SyncHandlerMap,
  _options: SyncWorkerOptions = {}
): Promise<{ processed: number; failed: number }> => ({ processed: 0, failed: 0 });

export const startSyncWorker = (
  _handlers: SyncHandlerMap,
  _options: SyncWorkerOptions = {}
): void => {};

export const stopSyncWorker = (): void => {};

const createDisabledRepository = () => ({
  create: async (payload: Partial<SyncableEntity>): Promise<SyncableEntity> => ({
    id: String(payload.id || generateId()),
    syncStatus: 'pending',
    lastSyncedAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    ...payload,
  }),
  update: async (id: string, patch: Partial<SyncableEntity>): Promise<SyncableEntity> => ({
    id,
    syncStatus: 'pending',
    lastSyncedAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    ...patch,
  }),
  remove: async (): Promise<void> => {},
  getById: async (): Promise<SyncableEntity | undefined> => undefined,
  list: async (): Promise<SyncableEntity[]> => [],
});

export const createOfflineRepository = createDisabledRepository;
export const productRepository = createDisabledRepository();
export const invoiceRepository = createDisabledRepository();
export const customerRepository = createDisabledRepository();

export const startDefaultOfflineSync = (): void => {};
export const stopDefaultOfflineSync = (): void => {};
