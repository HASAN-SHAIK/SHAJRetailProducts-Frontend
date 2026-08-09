/**
 * Local data service layer — sole entry point for UI and app utilities.
 * Delegates to repositories; never touches IndexedDB directly.
 */
export * from './databaseLocalService';
export * from './productLocalService';
export * from './categoryLocalService';
export * from './customerLocalService';
export * from './supplierLocalService';
export * from './inventoryLocalService';
export * from './transactionLocalService';
export * from './sessionLocalService';
export * from './configLocalService';
export * from './offlineLocalService';
export * from './purchaseLocalService';
export * from './syncLocalService';
export * from './staffLocalService';
export * from './returnsLocalService';
export * from './backupLocalService';
export * from './orderLocalService';
export * from './partialRefundLocalService';
export * from './returnHistoryLocalService';
export * from './reportLocalService';
export * from './applicationSettingsLocalService';
export * from './mobileLocalService';
export * from './offlineOperationLocalService';
