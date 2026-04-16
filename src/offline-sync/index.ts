import { defaultSyncHandlers } from './defaultHandlers';
import { startSyncWorker, stopSyncWorker } from './queue';

export * from './db';
export * from './types';
export * from './queue';
export * from './repository';
export * from './defaultHandlers';

export const startDefaultOfflineSync = (): void => {
  startSyncWorker(defaultSyncHandlers, {
    batchSize: 30,
    baseBackoffMs: 1000,
    maxBackoffMs: 60_000,
    intervalMs: 5000,
  });
};

export const stopDefaultOfflineSync = (): void => {
  stopSyncWorker();
};
