import * as storage from './internal/storage';

/** @implements {import('../Interfaces/IPurchaseRepository').IPurchaseRepository} */
export class IndexedDbPurchaseRepository {
  upsertLocalPurchase(purchase) {
    return storage.upsertLocalPurchase(purchase);
  }

  upsertLocalPurchasesBulk(purchases = []) {
    return storage.upsertLocalPurchasesBulk(purchases);
  }

  getLocalPurchases(status = null) {
    return storage.getLocalPurchases(status);
  }

  getLocalPurchaseById(purchaseId) {
    return storage.getLocalPurchaseById(purchaseId);
  }

  addLocalPurchaseItems(items = []) {
    return storage.addLocalPurchaseItems(items);
  }

  getLocalPurchaseItems(purchaseId) {
    return storage.getLocalPurchaseItems(purchaseId);
  }

  upsertLocalPurchaseReturn(entry) {
    return storage.upsertLocalPurchaseReturn(entry);
  }

  getLocalPurchaseReturns(status = null) {
    return storage.getLocalPurchaseReturns(status);
  }

  getLocalPurchaseReturnById(returnId) {
    return storage.getLocalPurchaseReturnById(returnId);
  }

  async listPurchases() {
    throw new Error('Purchase list requires an online SQL connection');
  }

  async getPurchaseDetail() {
    throw new Error('Purchase detail requires an online SQL connection');
  }

  async createPurchase() {
    throw new Error('Purchase create requires an online SQL connection');
  }

  async importPurchasePdf() {
    throw new Error('Purchase import requires an online SQL connection');
  }

  async createPurchaseReturn() {
    throw new Error('Purchase return requires an online SQL connection');
  }
}
