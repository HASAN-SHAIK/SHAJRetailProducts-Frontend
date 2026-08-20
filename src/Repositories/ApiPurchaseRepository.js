import * as storage from './internal/storage';
import {
  createPurchaseRemote,
  createPurchaseReturnRemote,
  fetchPurchaseDetailRemote,
  importPurchasePdfRemote,
  listPurchasesRemote,
} from './api/purchaseApiClient';

/** @implements {import('../Interfaces/IPurchaseRepository').IPurchaseRepository} */
export class ApiPurchaseRepository {
  constructor() {
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (prop in target) return Reflect.get(target, prop, receiver);
        const fallback = storage[prop];
        return typeof fallback === 'function' ? fallback.bind(storage) : fallback;
      },
    });
  }

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
