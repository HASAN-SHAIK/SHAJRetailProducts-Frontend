import {
  fetchBranchStock,
  fetchInventoryIntelligenceRemote,
  fetchStockConsistencyLatest,
  runStockConsistencyRemote,
} from './api/inventoryApiClient';
import { getStockCount, isBatchExpired, sumBatchQuantityRemaining } from './api/inventoryQuantity';

/** @implements {import('../Interfaces/IInventoryRepository').IInventoryRepository} */
export class ApiInventoryRepository {
  getBranchStock(productId, options = {}) {
    return fetchBranchStock(productId, options);
  }

  getStockConsistencyLatest() {
    return fetchStockConsistencyLatest();
  }

  runStockConsistency(options = {}) {
    return runStockConsistencyRemote(options);
  }

  fetchInventoryIntelligence(options = {}) {
    return fetchInventoryIntelligenceRemote(options);
  }

  getStockCount(product) {
    return getStockCount(product);
  }

  isBatchExpired(batch) {
    return isBatchExpired(batch);
  }

  sumBatchQuantityRemaining(batches) {
    return sumBatchQuantityRemaining(batches);
  }
}
