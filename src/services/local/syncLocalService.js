import { getSyncRepository } from '../../RepositoryFactory';
import { createRepositoryFacade } from './createRepositoryFacade';

export const {
  addInventorySyncQueueEntry,
  updateInventorySyncQueueEntry,
  getInventorySyncQueueEntries,
  findInventorySyncQueueEntry,
  addSyncLog,
  replaceProductIdReferences,
  replaceSupplierIdReferences,
  replaceCustomerIdReferences,
  addSyncQueueItem,
  updateSyncQueueItem,
  getSyncQueueItems,
  addProductIdMapping,
  getProductIdMappings,
  getAllSyncQueueRecords,
} = createRepositoryFacade(() => getSyncRepository(), [
  'addInventorySyncQueueEntry',
  'updateInventorySyncQueueEntry',
  'getInventorySyncQueueEntries',
  'findInventorySyncQueueEntry',
  'addSyncLog',
  'replaceProductIdReferences',
  'replaceSupplierIdReferences',
  'replaceCustomerIdReferences',
  'addSyncQueueItem',
  'updateSyncQueueItem',
  'getSyncQueueItems',
  'addProductIdMapping',
  'getProductIdMappings',
  'getAllSyncQueueRecords',
]);
