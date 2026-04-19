import {
  updateProductsBulk,
  getProductCacheById,
  deleteProductsCacheByIds,
  upsertLocalProduct,
} from '../core/db';
import { enqueueInventorySync, processInventorySyncQueue } from './inventorySync';

const createLocalId = () => `temp_${Date.now()}`;

const normalizeBarcode = (barcodeValue, idValue) => {
  const barcode = String(barcodeValue || '').trim();
  if (barcode) return barcode;
  if (idValue) return `id:${idValue}`;
  return null;
};

export const createOfflineProduct = async (payload) => {
  const id = createLocalId();
  const now = new Date().toISOString();
  const barcode = normalizeBarcode(payload.barcode, id);
  const product = {
    id,
    name: payload.product_name ?? payload.name ?? '',
    product_name: payload.product_name ?? payload.name ?? '',
    company: payload.company ?? '',
    category: payload.category ?? '',
    barcode,
    selling_price: payload.selling_price ?? null,
    purchase_price: payload.purchase_price ?? null,
    mrp: payload.mrp ?? null,
    stock_quantity: payload.stock_quantity ?? null,
    hsn_code: payload.hsn_code ?? null,
    gst_percentage: payload.gst_percentage ?? null,
    is_batch_enabled: payload.is_batch_enabled ?? null,
    batch_number: payload.batch_number ?? null,
    expiry_date: payload.expiry_date ?? null,
    time_for_delivery: payload.time_for_delivery ?? null,
    is_weight_based: payload.is_weight_based ?? null,
    created_at: now,
    updated_at: now,
    sync_status: 'pending',
  };
  await updateProductsBulk([product]);
  await upsertLocalProduct({
    id,
    name: product.name,
    syncStatus: 'pending',
    sync_status: 'pending',
    updatedAt: now,
  });
  await enqueueInventorySync({ type: 'product', entityId: id, action: 'create' });
  if (navigator.onLine) {
    processInventorySyncQueue().catch(() => {});
  }
  return product;
};

export const updateOfflineProduct = async (payload) => {
  const id = payload.id;
  if (!id) throw new Error('Missing product id');
  const existing = await getProductCacheById(id);
  const now = new Date().toISOString();
  const next = {
    ...(existing || {}),
    ...payload,
    id,
    name: payload.product_name ?? payload.name ?? existing?.name ?? existing?.product_name ?? '',
    product_name: payload.product_name ?? payload.name ?? existing?.product_name ?? existing?.name ?? '',
    updated_at: now,
    sync_status: 'pending',
  };
  if (payload.barcode !== undefined) {
    next.barcode = normalizeBarcode(payload.barcode, id);
  }
  await updateProductsBulk([next]);
  await upsertLocalProduct({
    id,
    name: next.name,
    syncStatus: 'pending',
    sync_status: 'pending',
    updatedAt: now,
  });
  await enqueueInventorySync({ type: 'product', entityId: id, action: 'update' });
  if (navigator.onLine) {
    processInventorySyncQueue().catch(() => {});
  }
  return next;
};

export const deleteOfflineProduct = async (productId) => {
  if (!productId) return;
  const existing = await getProductCacheById(productId);
  const now = new Date().toISOString();
  if (existing) {
    await updateProductsBulk([{ ...existing, is_deleted: true, sync_status: 'pending', updated_at: now }]);
  }
  await upsertLocalProduct({
    id: productId,
    name: existing?.name ?? existing?.product_name ?? '',
    syncStatus: 'pending',
    sync_status: 'pending',
    updatedAt: now,
    is_deleted: true,
  });
  await enqueueInventorySync({ type: 'product', entityId: productId, action: 'delete' });
  if (navigator.onLine) {
    processInventorySyncQueue().catch(() => {});
  }
};

