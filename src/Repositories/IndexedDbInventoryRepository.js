import { getStockCount, isBatchExpired, sumBatchQuantityRemaining } from './api/inventoryQuantity';

const offlineError = (action) => {
  const err = new Error(`${action} requires an online SQL connection`);
  err.code = 'INVENTORY_OFFLINE';
  return err;
};

/** @implements {import('../Interfaces/IInventoryRepository').IInventoryRepository} */
export class IndexedDbInventoryRepository {
  async getBranchStock() {
    return [];
  }

  async getStockConsistencyLatest() {
    return null;
  }

  async runStockConsistency() {
    throw offlineError('Stock consistency');
  }

  async fetchInventoryIntelligence() {
    return {};
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
