import { getSyncRepository } from '../../RepositoryFactory';
import { createRepositoryFacade } from './createRepositoryFacade';
import { isLegacyBrowserSyncAllowed } from '../../utils/legacyBrowserSyncAuthority';

const syncFacade = createRepositoryFacade(() => getSyncRepository(), [
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

export const {
  addInventorySyncQueueEntry,
  updateInventorySyncQueueEntry,
  findInventorySyncQueueEntry,
  addSyncLog,
  replaceProductIdReferences,
  replaceSupplierIdReferences,
  replaceCustomerIdReferences,
  addSyncQueueItem,
  updateSyncQueueItem,
  addProductIdMapping,
  getProductIdMappings,
} = syncFacade;

export const getInventorySyncQueueEntries = (...args) =>
  isLegacyBrowserSyncAllowed() ? syncFacade.getInventorySyncQueueEntries(...args) : Promise.resolve([]);

export const getSyncQueueItems = (...args) =>
  isLegacyBrowserSyncAllowed() ? syncFacade.getSyncQueueItems(...args) : Promise.resolve([]);

export const getAllSyncQueueRecords = (...args) =>
  isLegacyBrowserSyncAllowed() ? syncFacade.getAllSyncQueueRecords(...args) : Promise.resolve([]);
