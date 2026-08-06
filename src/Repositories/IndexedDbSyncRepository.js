import * as storage from './internal/storage';

/** @implements {import('../Interfaces/ISyncRepository').ISyncRepository} */
export class IndexedDbSyncRepository {
  addInventorySyncQueueEntry(entry) {
    return storage.addInventorySyncQueueEntry(entry);
  }

  updateInventorySyncQueueEntry(entry) {
    return storage.updateInventorySyncQueueEntry(entry);
  }

  getInventorySyncQueueEntries(statuses = ['pending', 'failed']) {
    return storage.getInventorySyncQueueEntries(statuses);
  }

  findInventorySyncQueueEntry(type, entityId, action) {
    return storage.findInventorySyncQueueEntry(type, entityId, action);
  }

  addSyncLog(payload) {
    return storage.addSyncLog(payload);
  }

  replaceProductIdReferences(oldId, newId) {
    return storage.replaceProductIdReferences(oldId, newId);
  }

  replaceSupplierIdReferences(oldId, newId) {
    return storage.replaceSupplierIdReferences(oldId, newId);
  }

  replaceCustomerIdReferences(oldId, newId) {
    return storage.replaceCustomerIdReferences(oldId, newId);
  }

  addSyncQueueItem(entry) {
    return storage.addSyncQueueItem(entry);
  }

  updateSyncQueueItem(entry) {
    return storage.updateSyncQueueItem(entry);
  }

  getSyncQueueItems(filters = {}) {
    return storage.getSyncQueueItems(filters);
  }

  addProductIdMapping(payload) {
    return storage.addProductIdMapping(payload);
  }

  getProductIdMappings() {
    return storage.getProductIdMappings();
  }

  getAllSyncQueueRecords() {
    return storage.db.sync_queue.toArray();
  }
}
