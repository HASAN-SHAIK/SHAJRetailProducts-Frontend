import {
  updateProductsBulk,
  getProductCacheById,
  upsertLocalProduct,
  getAllProducts,
  getAllBatches,
  updateBatchesBulk,
} from '../core/db';
import { enqueueInventorySync, processInventorySyncQueue } from './inventorySync';

const createLocalId = () => `temp_${Date.now()}`;

const normalizeBarcode = (barcodeValue, idValue) => {
  const barcode = String(barcodeValue || '').trim();
  if (barcode) return barcode;
  if (idValue) return `id:${idValue}`;
  return null;
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const asNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isBatchEnabled = (value) =>
  value === true ||
  String(value || '').trim() === '1' ||
  String(value || '').trim().toLowerCase() === 'true';

const isSameProductIdentity = (existing, payload) => {
  const existingName = normalizeText(existing?.name || existing?.product_name);
  const incomingName = normalizeText(payload?.product_name || payload?.name);
  const existingCompany = normalizeText(existing?.company);
  const incomingCompany = normalizeText(payload?.company);
  if (incomingName && existingName && existingName !== incomingName) return false;
  if (incomingCompany && existingCompany && existingCompany !== incomingCompany) return false;
  return true;
};

const hasMaterialDifferenceWithoutBatch = (existing, payload) => {
  const checks = [
    ['purchase_price', existing?.purchase_price, payload?.purchase_price],
    ['selling_price', existing?.selling_price, payload?.selling_price],
    ['mrp', existing?.mrp, payload?.mrp],
    ['gst_percentage', existing?.gst_percentage ?? existing?.gst_percent, payload?.gst_percentage],
    ['hsn_code', existing?.hsn_code, payload?.hsn_code],
    ['category', existing?.category, payload?.category],
    ['company', existing?.company, payload?.company],
    ['is_weight_based', existing?.is_weight_based, payload?.is_weight_based],
  ];
  return checks.some(([key, current, next]) => {
    if (next === undefined || next === null || String(next).trim() === '') return false;
    if (key.includes('price') || key === 'gst_percentage') {
      return asNumber(current) !== asNumber(next);
    }
    return normalizeText(current) !== normalizeText(next);
  });
};

const buildBatchEntry = (productId, payload, existingBatch = null) => {
  const now = new Date().toISOString();
  const qtyDelta = Math.max(asNumber(payload?.stock_quantity), 0);
  const prevQty = asNumber(existingBatch?.quantity);
  const prevRemaining = asNumber(existingBatch?.quantity_remaining);
  const batchNumberRaw = String(payload?.batch_number || existingBatch?.batch_number || '').trim();
  const batchNumber = batchNumberRaw || `LOCAL-${Date.now()}`;
  const syncVersion = Number(existingBatch?.sync_version ?? 0) + 1;

  return {
    ...(existingBatch || {}),
    id: existingBatch?.id || `local_batch_${productId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    product_id: productId,
    batch_number: batchNumber,
    expiry_date: payload?.expiry_date || existingBatch?.expiry_date || null,
    purchase_price: payload?.purchase_price ?? existingBatch?.purchase_price ?? null,
    selling_price: payload?.selling_price ?? existingBatch?.selling_price ?? null,
    mrp: payload?.mrp ?? existingBatch?.mrp ?? null,
    quantity: prevQty + qtyDelta,
    quantity_remaining: prevRemaining + qtyDelta,
    is_deleted: false,
    updated_at: now,
    created_at: existingBatch?.created_at || now,
    sync_version: syncVersion,
  };
};

const mergeStockQuantity = (existing, payload) =>
  String(Math.max(asNumber(existing?.stock_quantity), 0) + Math.max(asNumber(payload?.stock_quantity), 0));

export const createOfflineProduct = async (payload) => {
  const barcodeInput = String(payload?.barcode || '').trim();
  const productNameInput = String(payload?.product_name || payload?.name || '').trim();
  const batchModeEnabled = isBatchEnabled(payload?.is_batch_enabled);
  const batchNumberInput = String(payload?.batch_number || '').trim();
  const allProducts = (await getAllProducts()).filter((item) => !item?.is_deleted);

  const existingByBarcode = barcodeInput
    ? allProducts.find((item) => normalizeText(item?.barcode) === normalizeText(barcodeInput))
    : null;

  if (existingByBarcode) {
    const sameIdentity = isSameProductIdentity(existingByBarcode, payload);
    if (!sameIdentity) {
      throw new Error('Barcode already exists for another product. Please verify barcode.');
    }

    if (batchModeEnabled) {
      if (!batchNumberInput) {
        throw new Error('Batch Number is required when adding existing barcode product in batch mode.');
      }

      const allBatches = await getAllBatches();
      const matchingBatch = (Array.isArray(allBatches) ? allBatches : []).find(
        (batch) =>
          String(batch?.product_id || '') === String(existingByBarcode.id || '') &&
          normalizeText(batch?.batch_number) === normalizeText(batchNumberInput) &&
          batch?.is_deleted !== true
      );

      const nextBatch = buildBatchEntry(existingByBarcode.id, payload, matchingBatch || null);
      await updateBatchesBulk([nextBatch]);

      const updated = await updateOfflineProduct({
        ...existingByBarcode,
        id: existingByBarcode.id,
        product_name: existingByBarcode?.name || existingByBarcode?.product_name || productNameInput,
        stock_quantity: mergeStockQuantity(existingByBarcode, payload),
        is_batch_enabled: '1',
        batch_number: batchNumberInput,
        expiry_date: payload?.expiry_date ?? existingByBarcode?.expiry_date ?? null,
        purchase_price: payload?.purchase_price ?? existingByBarcode?.purchase_price ?? null,
        selling_price: payload?.selling_price ?? existingByBarcode?.selling_price ?? null,
        mrp: payload?.mrp ?? existingByBarcode?.mrp ?? null,
      });
      return { ...updated, __local_notice: 'batch_saved_existing_product' };
    }

    if (hasMaterialDifferenceWithoutBatch(existingByBarcode, payload)) {
      throw new Error('Product already present. For different price/details, please enable Batch and use Batch Number.');
    }

    const updated = await updateOfflineProduct({
      ...existingByBarcode,
      id: existingByBarcode.id,
      product_name: existingByBarcode?.name || existingByBarcode?.product_name || productNameInput,
      stock_quantity: mergeStockQuantity(existingByBarcode, payload),
    });
    return { ...updated, __local_notice: 'merged_existing_product' };
  }

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

