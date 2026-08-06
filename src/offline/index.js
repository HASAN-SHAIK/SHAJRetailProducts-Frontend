export * from './constants';
export * from './offlineEntityState';
export * from './offlineFirstPolicy';
export * from './conflictResolution';
export { OfflineSyncCoordinator, offlineSyncCoordinator } from './OfflineSyncCoordinator';

/**
 * Desktop offline-first architecture (IndexedDB local store + SQL when online).
 *
 * Layers:
 * 1. Local store (IndexedDB) — authoritative for offline reads/writes on desktop
 * 2. Entity sync state — syncStatus / isSynced flags per record
 * 3. Operation queue — durable pending CREATE/UPDATE/DELETE operations
 * 4. Sync coordinator (stub) — future push/pull to PostgreSQL APIs
 *
 * Data flow (target):
 *   UI → *LocalService → Api*Repository (online) / IndexedDb*Repository (offline)
 *        └─ enqueueOperation() when mutation cannot reach SQL
 *        └─ OfflineSyncCoordinator.processQueue() [future] → SQL APIs
 */
