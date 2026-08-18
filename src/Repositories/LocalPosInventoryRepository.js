import { getStockCount, isBatchExpired, sumBatchQuantityRemaining } from './api/inventoryQuantity';
import { localPosRequest } from './local/posLocalApiClient';

const unsupportedAtEdge = (action) => {
  const error = new Error(`${action} remains a Central administrative operation`);
  error.code = 'LOCAL_POS_INVENTORY_READ_ONLY';
  return error;
};

/** @implements {import('../Interfaces/IInventoryRepository').IInventoryRepository} */
export class LocalPosInventoryRepository {
  async getBranchStock(productId) {
    const id = String(productId || '').trim();
    if (!id) return [];
    const balance = await localPosRequest(`/inventory/balances/${encodeURIComponent(id)}`);
    return [
      {
        branch_id: balance?.store_id ?? null,
        branch: 'Local POS',
        quantity: Number(balance?.on_hand_milli ?? 0) / 1000,
        on_hand_milli: Number(balance?.on_hand_milli ?? 0),
        reserved_milli: Number(balance?.reserved_milli ?? 0),
        available_milli: Number(balance?.available_milli ?? 0),
        version: Number(balance?.version ?? 0),
        updated_at: balance?.updated_at ?? null,
      },
    ];
  }

  async getStockConsistencyLatest() {
    return null;
  }

  async runStockConsistency() {
    throw unsupportedAtEdge('Stock consistency');
  }

  async fetchInventoryIntelligence() {
    throw unsupportedAtEdge('Inventory intelligence');
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
