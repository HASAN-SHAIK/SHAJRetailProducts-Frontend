export type SyncQueueStatus = 'pending' | 'syncing' | 'success' | 'failed';

export type SyncOperation = 'create' | 'update' | 'delete';

export type SyncEntityName = 'product' | 'invoice' | 'customer' | (string & {});

export interface SyncMetadata {
  syncStatus: 'pending' | 'synced' | 'failed';
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SyncableEntity {
  id: string;
  syncStatus: SyncMetadata['syncStatus'];
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  [key: string]: unknown;
}

export interface SyncQueueItem<TPayload = unknown> {
  id: string;
  entity: SyncEntityName;
  entityId: string;
  operation: SyncOperation;
  payload: TPayload;
  status: SyncQueueStatus;
  retryCount: number;
  nextRetryAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SyncHandlerContext<TPayload = unknown> {
  queueItem: SyncQueueItem<TPayload>;
}

export type SyncHandler<TPayload = unknown> = (
  context: SyncHandlerContext<TPayload>
) => Promise<void>;

export type SyncHandlerMap = Partial<
  Record<SyncEntityName, Partial<Record<SyncOperation, SyncHandler>>>
>;

export interface SyncWorkerOptions {
  batchSize?: number;
  maxRetries?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  intervalMs?: number;
}
