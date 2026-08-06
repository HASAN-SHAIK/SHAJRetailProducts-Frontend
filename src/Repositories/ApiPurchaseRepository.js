import { IndexedDbPurchaseRepository } from './IndexedDbPurchaseRepository';
import {
  createPurchaseRemote,
  createPurchaseReturnRemote,
  fetchPurchaseDetailRemote,
  importPurchasePdfRemote,
  listPurchasesRemote,
} from './api/purchaseApiClient';

/** @implements {import('../Interfaces/IPurchaseRepository').IPurchaseRepository} */
export class ApiPurchaseRepository extends IndexedDbPurchaseRepository {
  listPurchases(options = {}) {
    return listPurchasesRemote(options);
  }

  getPurchaseDetail(purchaseId) {
    return fetchPurchaseDetailRemote(purchaseId);
  }

  createPurchase(payload) {
    return createPurchaseRemote(payload);
  }

  importPurchasePdf(formData) {
    return importPurchasePdfRemote(formData);
  }

  createPurchaseReturn(payload) {
    return createPurchaseReturnRemote(payload);
  }
}
