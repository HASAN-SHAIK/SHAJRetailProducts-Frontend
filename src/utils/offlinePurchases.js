import {
  addLocalBatchCache,
  addLocalPurchaseItems,
  getSupplierCacheById,
  getLocalPurchases,
  upsertSupplierLedgerEntry,
  updateProductsCacheStock,
  updateProductsCacheBulk,
  updateSuppliersCacheBulk,
  upsertLocalPurchase,
} from '../core/db';
import { enqueueInventorySync, processInventorySyncQueue } from './inventorySync';

const STATUS_PENDING = 'pending';

const createLocalId = () =>
  `temp_${Date.now()}`;

const createLocalProductId = () =>
  `local_product_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

const broadcastUpdate = () => {
  window.dispatchEvent(
    new CustomEvent('offline-purchase-updated', {
      detail: { updatedAt: new Date().toISOString() },
    })
  );
};

export const enqueueOfflinePurchase = async (payload) => {
  const local_id = createLocalId();
  const created_at = new Date().toISOString();
  const purchase = {
    id: local_id,
    supplierId: payload.supplier_id ?? null,
    branchId: payload.branch_id ?? null,
    invoiceNumber: payload.invoice_number ?? null,
    paymentMode: payload.payment_mode ?? null,
    totalPrice: payload.total_price ?? null,
    createdAt: created_at,
    date: created_at,
    syncStatus: STATUS_PENDING,
    sync_status: STATUS_PENDING,
  };

  const items = (payload.items || []).map((item, index) => {
    const providedId = item.product_id || null;
    const needsLocalId = !providedId && item.name;
    const localProductId = needsLocalId ? createLocalProductId() : null;
    return {
      id: `temp_item_${local_id}_${index + 1}`,
      purchaseId: local_id,
      productId: providedId || localProductId,
      batch_number: item.batch_number ?? null,
      name: item.name ?? null,
      barcode: item.barcode ?? null,
      category: item.category ?? null,
      company: item.company ?? null,
      mrp: item.mrp ?? null,
      quantity: item.quantity ?? 0,
      purchase_price: item.purchase_price ?? 0,
      selling_price: item.selling_price ?? null,
      gst_percent: item.gst_percent ?? null,
      expiry_date: item.expiry_date ?? null,
      __local_product: Boolean(needsLocalId),
      __batch_index: index + 1,
    };
  });

  await upsertLocalPurchase(purchase);
  await addLocalPurchaseItems(items);
  await enqueueInventorySync({ type: 'purchase', entityId: local_id, action: 'create' });

  if (payload.supplier_id) {
    const supplierId = String(payload.supplier_id);
    const supplier = await getSupplierCacheById(payload.supplier_id);
    const amount = Number(payload.total_price || 0);
    const currentBalance = Number(supplier?.current_balance || 0);
    const nextBalance = supplier ? currentBalance + amount : null;
    const ledgerEntry = {
      id: local_id,
      supplier_id: supplierId,
      type: 'purchase',
      amount,
      payment_mode: payload.payment_mode || null,
      running_balance: nextBalance,
      created_at,
      sync_status: STATUS_PENDING,
    };
    await upsertSupplierLedgerEntry(ledgerEntry).catch(() => {});
    if (supplier) {
      await updateSuppliersCacheBulk([{ ...supplier, current_balance: nextBalance }]).catch(() => {});
    }
  }

  for (const item of items) {
    if (item.productId) {
      await updateProductsCacheStock(
        item.productId,
        Number(item.quantity || 0),
        payload.branch_id
      );
    }
    await addLocalBatchCache({
      id: `local_batch_${local_id}_${item.__batch_index}`,
      product_id: item.productId || null,
      branch_id: payload.branch_id ?? null,
      batch_number: item.batch_number || `LOCAL-${local_id}-${item.__batch_index}`,
      expiry_date: item.expiry_date ?? null,
      purchase_price: item.purchase_price ?? null,
      selling_price: item.selling_price ?? null,
      mrp: item.mrp ?? null,
      quantity: item.quantity ?? 0,
      quantity_remaining: item.quantity ?? 0,
      created_at,
    });
  }

  if (items.length) {
    const productsToCache = items
      .filter((item) => item.__local_product)
      .map((item) => ({
        id: item.productId,
        name: item.name,
        barcode: item.barcode ?? null,
        category: item.category,
        company: item.company,
        selling_price: item.selling_price ?? item.purchase_price,
        purchase_price: item.purchase_price,
        gst_percentage: item.gst_percent ?? null,
        stock_quantity: Number(item.quantity || 0),
        branch_id: payload.branch_id ?? null,
        created_at,
      }));
    if (productsToCache.length) {
      await updateProductsCacheBulk(productsToCache).catch(() => {});
    }
  }

  broadcastUpdate();
  return { local_id, status: STATUS_PENDING };
};

export const processOfflinePurchasesQueue = async () => {
  if (!navigator.onLine) return { synced: [], failed: [] };
  const pending = await getLocalPurchases(STATUS_PENDING);
  if (!pending.length) return { synced: [], failed: [] };
  const results = await processInventorySyncQueue();
  const synced = results.filter((entry) => entry.type === 'purchase' && entry.status === 'synced');
  if (synced.length) {
    broadcastUpdate();
  }
  return { synced, failed: [] };
};
