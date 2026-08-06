import * as storage from './internal/storage';

/** @implements {import('../Interfaces/IOfflineRepository').IOfflineRepository} */
export class IndexedDbOfflineRepository {
  getOfflineOrders() {
    return storage.getOfflineOrders();
  }

  saveOfflineOrdersBulk(orders) {
    return storage.saveOfflineOrdersBulk(orders);
  }

  upsertOfflineOrder(entry) {
    return storage.upsertOfflineOrder(entry);
  }

  deleteOfflineOrdersByIds(ids) {
    return storage.deleteOfflineOrdersByIds(ids);
  }

  upsertOfflinePurchase(purchase) {
    return storage.upsertOfflinePurchase(purchase);
  }

  addOfflinePurchaseItems(items = []) {
    return storage.addOfflinePurchaseItems(items);
  }

  getOfflinePurchases(status = null) {
    return storage.getOfflinePurchases(status);
  }

  getOfflinePurchaseItems(localPurchaseId) {
    return storage.getOfflinePurchaseItems(localPurchaseId);
  }

  upsertOfflinePurchaseReturn(returnEntry) {
    return storage.upsertOfflinePurchaseReturn(returnEntry);
  }

  getOfflinePurchaseReturns(status = null) {
    return storage.getOfflinePurchaseReturns(status);
  }

  addOfflineImport(payload = {}) {
    return storage.addOfflineImport(payload);
  }

  getOfflineImports() {
    return storage.getOfflineImports();
  }

  getOfflineImportItems(importId) {
    return storage.getOfflineImportItems(importId);
  }

  updateOfflineImport(entry) {
    return storage.updateOfflineImport(entry);
  }

  updateOfflineImportStatus(importId, status) {
    return storage.updateOfflineImportStatus(importId, status);
  }
}
