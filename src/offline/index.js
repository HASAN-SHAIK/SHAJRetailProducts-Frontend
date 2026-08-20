export * from './constants';
export * from './offlineEntityState';
export * from './offlineFirstPolicy';
export * from './conflictResolution';
export { OfflineSyncCoordinator, offlineSyncCoordinator } from './OfflineSyncCoordinator';

/**
 * Desktop offline-first architecture.
 *
 * POSService/SQLite is the authoritative local store for desktop offline
 * reads, writes, and queues. Browser storage modules are retained only as
 * compatibility facades for older imports.
 */
