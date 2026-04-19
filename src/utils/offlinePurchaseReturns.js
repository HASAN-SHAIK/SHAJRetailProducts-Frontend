import {
  addLocalBatchCache,
  getBatchCacheById,
  updateProductsCacheStock,
  upsertLocalPurchaseReturn,
  getLocalPurchaseReturns,
} from '../core/db';
import { enqueueInventorySync, processInventorySyncQueue } from './inventorySync';

const STATUS_PENDING = 'pending';

const createLocalId = () =>
  `temp_${Date.now()}`;

const broadcastUpdate = () => {
  window.dispatchEvent(
    new CustomEvent('offline-purchase-return-updated', {
      detail: { updatedAt: new Date().toISOString() },
    })
  );
};

export const enqueueOfflinePurchaseReturn = async (payload) => {
  const local_id = createLocalId();
  const created_at = new Date().toISOString();
  const entry = {
    id: local_id,
    purchaseId: payload.purchase_id ?? null,
    supplierId: payload.supplier_id ?? null,
    branchId: payload.branch_id ?? null,
    reason: payload.reason ?? null,
    items: payload.items ?? [],
    createdAt: created_at,
    date: created_at,
    syncStatus: STATUS_PENDING,
    sync_status: STATUS_PENDING,
  };

  await upsertLocalPurchaseReturn(entry);
  await enqueueInventorySync({ type: 'purchase_return', entityId: local_id, action: 'create' });

  for (const item of payload.items || []) {
    const qty = Number(item.quantity || 0);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    if (item.product_id) {
      await updateProductsCacheStock(item.product_id, -qty, payload.branch_id);
      const batch = item.batch_id ? await getBatchCacheById(item.batch_id) : null;
      if (batch) {
        const nextRemaining = Math.max(0, Number(batch.quantity_remaining || 0) - qty);
        await addLocalBatchCache({ ...batch, quantity_remaining: nextRemaining });
      }
    }
  }

  broadcastUpdate();
  return { local_id, status: STATUS_PENDING };
};

export const processOfflinePurchaseReturnsQueue = async () => {
  if (!navigator.onLine) return { synced: [], failed: [] };
  const pending = await getLocalPurchaseReturns(STATUS_PENDING);
  if (!pending.length) return { synced: [], failed: [] };
  const results = await processInventorySyncQueue();
  const synced = results.filter((entry) => entry.type === 'purchase_return' && entry.status === 'synced');
  if (synced.length) {
    broadcastUpdate();
  }
  return { synced, failed: [] };
};
