import api from './axios';
import {
  addInventorySyncQueueEntry,
  updateInventorySyncQueueEntry,
  getInventorySyncQueueEntries,
  findInventorySyncQueueEntry,
  addSyncLog,
  getProductCacheById,
  getSupplierCacheById,
  updateProductsBulk,
  updateBatchesBulk,
  updateSuppliersCacheBulk,
  deleteProductsCacheByIds,
  deleteSuppliersCacheByIds,
  deleteBatchesCacheByIds,
  getAllBatches,
  getLocalPurchaseById,
  getLocalPurchaseItems,
  upsertLocalPurchase,
  upsertLocalProduct,
  upsertLocalSupplier,
  upsertLocalPurchaseReturn,
  getLocalPurchaseReturnById,
  replaceProductIdReferences,
  replaceSupplierIdReferences,
  getTransactionById,
  upsertAccountingTransaction,
  getLocalPurchases,
  db,
} from '../core/db';
import { runDeltaSync } from './deltaSync';

const SYNC_INTERVAL_MS = 30000;
let syncTimer = null;
let isSyncing = false;
let syncRerunRequested = false;

const nowIso = () => new Date().toISOString();
const isNumericId = (value) => Number.isFinite(Number(value));

const normalizeStatus = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'pending' || normalized === 'synced' || normalized === 'failed') {
    return normalized;
  }
  return 'pending';
};

const emitSyncEvent = (type) => {
  if (typeof window === 'undefined') return;
  try {
    if (type === 'purchase') {
      window.dispatchEvent(new CustomEvent('offline-purchase-updated'));
    }
    if (type === 'purchase_return') {
      window.dispatchEvent(new CustomEvent('offline-purchase-return-updated'));
    }
  } catch {
    // ignore
  }
};

const buildProductPayload = (product) => {
  if (!product) return null;
  const barcodeValue = product.barcode || product.product_barcode || product.productBarcode || '';
  const payload = {
    product_name: product.name ?? product.product_name ?? '',
    company: product.company ?? product.company_name ?? '',
    category: product.category ?? product.category_name ?? '',
    purchase_price: product.purchase_price ?? null,
    selling_price: product.selling_price ?? null,
    mrp: product.mrp ?? product.mrp_price ?? null,
    stock_quantity: product.stock_quantity ?? product.stock ?? null,
    hsn_code: product.hsn_code ?? null,
    gst_percentage: product.gst_percentage ?? product.gst_percent ?? null,
    is_batch_enabled: product.is_batch_enabled ?? null,
    batch_number: product.batch_number ?? null,
    expiry_date: product.expiry_date ?? null,
    time_for_delivery: product.time_for_delivery ?? null,
    is_weight_based: product.is_weight_based ?? null,
  };
  if (barcodeValue && !String(barcodeValue).startsWith('id:')) {
    payload.barcode = barcodeValue;
  }
  return payload;
};

const buildSupplierPayload = (supplier) => {
  if (!supplier) return null;
  return {
    name: supplier.name ?? '',
    mobile: supplier.mobile ?? supplier.phone ?? '',
    email: supplier.email ?? '',
    gst_number: supplier.gst_number ?? '',
    credit_limit: supplier.credit_limit ?? 0,
    address: supplier.address ?? '',
    is_active: supplier.is_active ?? true,
  };
};

const setProductSyncStatus = async (productId, status, extras = {}) => {
  if (!productId) return;
  const normalized = normalizeStatus(status);
  const existingLocal = await db.products.get(productId);
  await upsertLocalProduct({
    ...(existingLocal || { id: productId }),
    syncStatus: normalized,
    sync_status: normalized,
    updatedAt: nowIso(),
    ...extras,
  });
  const existingCache = await getProductCacheById(productId);
  if (existingCache) {
    await updateProductsBulk([{ ...existingCache, sync_status: normalized, updated_at: nowIso(), ...extras }]);
  }
};

const setSupplierSyncStatus = async (supplierId, status, extras = {}) => {
  if (!supplierId) return;
  const normalized = normalizeStatus(status);
  const existingLocal = await db.suppliers.get(supplierId);
  await upsertLocalSupplier({
    ...(existingLocal || { id: supplierId }),
    syncStatus: normalized,
    sync_status: normalized,
    updatedAt: nowIso(),
    ...extras,
  });
  const existingCache = await getSupplierCacheById(supplierId);
  if (existingCache) {
    await updateSuppliersCacheBulk([{ ...existingCache, sync_status: normalized, updated_at: nowIso(), ...extras }]);
  }
};

const setPurchaseSyncStatus = async (purchaseId, status, extras = {}) => {
  if (!purchaseId) return;
  const normalized = normalizeStatus(status);
  const existing = await getLocalPurchaseById(purchaseId);
  await upsertLocalPurchase({
    ...(existing || { id: purchaseId }),
    syncStatus: normalized,
    sync_status: normalized,
    updatedAt: nowIso(),
    ...extras,
  });
};

const setReturnSyncStatus = async (returnId, status, extras = {}) => {
  if (!returnId) return;
  const normalized = normalizeStatus(status);
  const existing = await getLocalPurchaseReturnById(returnId);
  await upsertLocalPurchaseReturn({
    ...(existing || { id: returnId }),
    syncStatus: normalized,
    sync_status: normalized,
    updatedAt: nowIso(),
    ...extras,
  });
};

export const enqueueInventorySync = async ({ type, entityId, action }) => {
  if (!type || !entityId || !action) return null;
  const existing = await findInventorySyncQueueEntry(type, entityId, action);
  const next = {
    type,
    entityId,
    action,
    status: 'pending',
    retries: existing?.retries ?? 0,
    updated_at: nowIso(),
    createdAt: existing?.createdAt ?? nowIso(),
  };
  if (existing) {
    return await updateInventorySyncQueueEntry({ ...existing, ...next, id: existing.id });
  }
  return await addInventorySyncQueueEntry(next);
};

const resolveServerId = (response) =>
  response?.data?.id ||
  response?.data?.product_id ||
  response?.data?.supplier_id ||
  response?.data?.order_id ||
  response?.data?.return_id ||
  response?.data?.data?.id ||
  response?.data?.data?.order_id ||
  null;

const cleanupLocalPurchaseBatches = async (localPurchaseId) => {
  if (!localPurchaseId) return;
  const key = String(localPurchaseId);
  const allBatches = await getAllBatches();
  const toDelete = (Array.isArray(allBatches) ? allBatches : [])
    .filter((batch) => {
      if (!batch) return false;
      const batchId = String(batch.id || '');
      const batchNumber = String(batch.batch_number || '').toUpperCase();
      const purchaseOrderId = String(batch.purchase_order_id || '');
      return (
        batchId.startsWith(`local_batch_${key}_`) ||
        batchNumber.startsWith(`LOCAL-${key.toUpperCase()}-`) ||
        purchaseOrderId === key
      );
    })
    .map((batch) => batch.id)
    .filter(Boolean);
  if (!toDelete.length) return;
  await deleteBatchesCacheByIds(toDelete);
};

const syncProductEntry = async (entry) => {
  const product = await getProductCacheById(entry.entityId);
  if (!product && entry.action !== 'delete') {
    await setProductSyncStatus(entry.entityId, 'synced', { last_error: 'missing' });
    return { status: 'synced', note: 'missing product' };
  }
  if (entry.action === 'delete') {
    if (String(entry.entityId).startsWith('temp_')) {
      await deleteProductsCacheByIds([entry.entityId]);
      await db.products.delete(entry.entityId);
      return { status: 'synced', note: 'local delete' };
    }
    await api.delete(`/products/${encodeURIComponent(entry.entityId)}`);
    await deleteProductsCacheByIds([entry.entityId]);
    await db.products.delete(entry.entityId);
    return { status: 'synced' };
  }
  const payload = buildProductPayload(product);
  if (!payload) throw new Error('missing payload');
  if (entry.action === 'create') {
    const response = await api.post('/products', payload);
    const serverProduct = response?.data?.product || response?.data?.data || response?.data || null;
    const serverId = serverProduct?.id ?? resolveServerId(response);
    if (serverId && serverId !== entry.entityId) {
      await replaceProductIdReferences(entry.entityId, serverId);
      await db.products.delete(entry.entityId);
      await upsertLocalProduct({
        ...(serverProduct || product),
        id: serverId,
        syncStatus: 'synced',
        sync_status: 'synced',
        updatedAt: nowIso(),
      });
    } else {
      await setProductSyncStatus(entry.entityId, 'synced');
    }
    if (serverProduct) {
      await updateProductsBulk([{ ...serverProduct, sync_status: 'synced' }]);
    }
    return { status: 'synced', serverId };
  }
  await api.put(`/products/${encodeURIComponent(entry.entityId)}`, payload);
  await setProductSyncStatus(entry.entityId, 'synced');
  return { status: 'synced' };
};

const syncSupplierEntry = async (entry) => {
  const supplier = await getSupplierCacheById(entry.entityId);
  if (!supplier && entry.action !== 'delete') {
    await setSupplierSyncStatus(entry.entityId, 'synced', { last_error: 'missing' });
    return { status: 'synced', note: 'missing supplier' };
  }
  if (entry.action === 'delete') {
    if (String(entry.entityId).startsWith('temp_')) {
      await deleteSuppliersCacheByIds([entry.entityId]);
      await db.suppliers.delete(entry.entityId);
      return { status: 'synced', note: 'local delete' };
    }
    await api.delete(`/suppliers/${encodeURIComponent(entry.entityId)}`);
    await deleteSuppliersCacheByIds([entry.entityId]);
    await db.suppliers.delete(entry.entityId);
    return { status: 'synced' };
  }
  const payload = buildSupplierPayload(supplier);
  if (!payload) throw new Error('missing payload');
  if (entry.action === 'create') {
    const response = await api.post('/suppliers', payload);
    const serverSupplier = response?.data?.supplier || response?.data?.data || response?.data || null;
    const serverId = serverSupplier?.id ?? resolveServerId(response);
    if (serverId && serverId !== entry.entityId) {
      await replaceSupplierIdReferences(entry.entityId, serverId);
      await db.suppliers.delete(entry.entityId);
      await upsertLocalSupplier({
        ...(serverSupplier || supplier),
        id: serverId,
        syncStatus: 'synced',
        sync_status: 'synced',
        updatedAt: nowIso(),
      });
    } else {
      await setSupplierSyncStatus(entry.entityId, 'synced');
    }
    if (serverSupplier) {
      await updateSuppliersCacheBulk([{ ...serverSupplier, sync_status: 'synced' }]);
    }
    return { status: 'synced', serverId };
  }
  await api.put(`/suppliers/${encodeURIComponent(entry.entityId)}`, payload);
  await setSupplierSyncStatus(entry.entityId, 'synced');
  return { status: 'synced' };
};

const syncPurchaseEntry = async (entry) => {
  const purchase = await getLocalPurchaseById(entry.entityId);
  if (!purchase) {
    await setPurchaseSyncStatus(entry.entityId, 'synced', { last_error: 'missing' });
    return { status: 'synced', note: 'missing purchase' };
  }

  const supplierId = purchase.supplierId ?? purchase.supplier_id ?? null;
  if (supplierId && String(supplierId).startsWith('temp_')) {
    throw new Error('supplier_not_synced');
  }

  const items = await getLocalPurchaseItems(entry.entityId);
  const payloadItems = items.map((item) => ({
    product_id: item.__local_product ? undefined : item.productId ?? item.product_id,
    batch_number: item.batch_number || undefined,
    barcode: item.barcode || undefined,
    name: item.name || undefined,
    category: item.category || undefined,
    company: item.company || undefined,
    mrp: item.mrp || undefined,
    quantity: Number(item.quantity || 0),
    purchase_price: Number(item.purchase_price || 0),
    selling_price: Number(item.selling_price || 0),
    gst_percent: Number(item.gst_percent || 0),
    expiry_date: item.expiry_date || null,
  }));
  const normalizedMode = String(purchase.paymentMode ?? purchase.payment_mode ?? '').trim().toLowerCase() === 'online'
    ? 'upi'
    : String(purchase.paymentMode ?? purchase.payment_mode ?? '').trim().toLowerCase();
  const isCreditPurchase = normalizedMode === 'credit';
  const syncedTotalAmount = Number(purchase.totalPrice ?? purchase.total_price ?? 0);
  const syncedTotalPaid = isCreditPurchase
    ? 0
    : Number(purchase.totalPaid ?? purchase.total_paid ?? purchase.paidAmount ?? purchase.paid_amount ?? 0);
  const syncedBalance = isCreditPurchase
    ? Math.max(syncedTotalAmount, 0)
    : Number(purchase.balance ?? Math.max(syncedTotalAmount - syncedTotalPaid, 0));
  const response = await api.post('/purchases', {
    type: 'purchase',
    order_type: 'purchase',
    source_type: 'purchase',
    transaction_type: 'purchase',
    billing_type: 'purchase',
    branch_id: purchase.branchId ?? purchase.branch_id ?? null,
    supplier_id: purchase.supplierId ?? purchase.supplier_id ?? null,
    invoice_number: purchase.invoiceNumber ?? purchase.invoice_number ?? null,
    payment_mode: normalizedMode || null,
    paid_amount: syncedTotalPaid,
    total_paid: syncedTotalPaid,
    balance: syncedBalance,
    payment_status: isCreditPurchase ? 'pending' : (purchase.paymentStatus ?? purchase.payment_status ?? (syncedBalance > 0 ? 'pending' : 'paid')),
    items: payloadItems,
  });
  const responseData = response?.data?.data || response?.data || {};
  const createdBatches = Array.isArray(responseData?.batches) ? responseData.batches : [];
  if (createdBatches.length) {
    const batchesForCache = createdBatches.map((batch) => ({
      id: batch?.id,
      product_id: batch?.product_id ?? null,
      branch_id: batch?.branch_id ?? (purchase.branchId ?? purchase.branch_id ?? null),
      batch_number: batch?.batch_number ?? null,
      expiry_date: batch?.expiry_date ?? null,
      purchase_price: batch?.purchase_price ?? null,
      selling_price: batch?.selling_price ?? null,
      mrp: batch?.mrp ?? null,
      quantity: Number(batch?.quantity ?? 0),
      quantity_remaining: Number(batch?.quantity_remaining ?? batch?.quantity ?? 0),
      purchase_order_id: responseData?.order_id ?? null,
      is_deleted: false,
      updated_at: batch?.updated_at ?? nowIso(),
      created_at: batch?.created_at ?? nowIso(),
      sync_status: 'synced',
    })).filter((batch) => batch.id);
    if (batchesForCache.length) {
      await updateBatchesBulk(batchesForCache).catch(() => {});
    }
  }
  const serverId = resolveServerId(response);
  await setPurchaseSyncStatus(entry.entityId, 'synced', {
    serverId: serverId ?? purchase.serverId ?? null,
    syncedAt: nowIso(),
  });
  await cleanupLocalPurchaseBatches(entry.entityId).catch(() => {});
  return { status: 'synced', serverId };
};

const syncPurchaseReturnEntry = async (entry) => {
  const returnEntry = await getLocalPurchaseReturnById(entry.entityId);
  if (!returnEntry) {
    await setReturnSyncStatus(entry.entityId, 'synced', { last_error: 'missing' });
    return { status: 'synced', note: 'missing return' };
  }
  const purchaseId = returnEntry.purchaseId ?? returnEntry.purchase_id ?? null;
  if (purchaseId) {
    const purchase = await getLocalPurchaseById(purchaseId);
    if (purchase && purchase.serverId) {
      returnEntry.purchaseId = purchase.serverId;
    } else if (purchase && !purchase.serverId) {
      throw new Error('purchase_not_synced');
    } else if (!isNumericId(purchaseId)) {
      throw new Error('purchase_not_synced');
    }
  }

  const supplierId = returnEntry.supplierId ?? returnEntry.supplier_id ?? null;
  if (supplierId && String(supplierId).startsWith('temp_')) {
    throw new Error('supplier_not_synced');
  }

  const response = await api.post('/purchase-returns', {
    purchase_id: returnEntry.purchaseId ?? null,
    supplier_id: supplierId,
    branch_id: returnEntry.branchId ?? returnEntry.branch_id ?? null,
    reason: returnEntry.reason ?? null,
    items: returnEntry.items ?? [],
  });
  const serverId = resolveServerId(response);
  await setReturnSyncStatus(entry.entityId, 'synced', {
    serverId: serverId ?? returnEntry.serverId ?? null,
    syncedAt: nowIso(),
  });
  return { status: 'synced', serverId };
};

const syncAccountingEntry = async (entry) => {
  const txn = await getTransactionById(entry.entityId);
  if (!txn) {
    return { status: 'synced', note: 'missing transaction' };
  }
  const txnType = String(txn.txn_type || txn.txnType || '').toLowerCase();
  if (txnType !== 'receipt' && txnType !== 'payment') {
    await upsertAccountingTransaction({
      ...txn,
      sync_status: 'synced',
      synced_at: nowIso(),
    });
    return { status: 'synced', note: 'noop' };
  }
  const payload = {
    amount: Number(txn.amount ?? txn.total_price ?? 0),
    payment_mode: txn.payment_mode || 'cash',
    notes: txn.notes || null,
    order_id: txn.order_id || txn.orderId || null,
    reference_type: txn.reference_type || txn.referenceType || null,
    reference_id: txn.reference_id || txn.referenceId || txn.order_id || txn.orderId || null,
    date: txn.date || txn.created_at || null,
    client_txn_id: txn.client_txn_id || txn.clientTxnId || String(txn.id || ''),
  };
  if (txnType === 'receipt') {
    payload.customer_id = txn.party_id || txn.partyId;
    if (payload.customer_id && String(payload.customer_id).startsWith('temp')) {
      throw new Error('customer_not_synced');
    }
  } else {
    payload.supplier_id = txn.party_id || txn.partyId;
    if (payload.supplier_id && String(payload.supplier_id).startsWith('temp')) {
      throw new Error('supplier_not_synced');
    }
  }
  const isSupplierLedger = txn.source === 'supplier_ledger' && txnType === 'payment';
  const response = isSupplierLedger
    ? await api.post(`/suppliers/${encodeURIComponent(payload.supplier_id)}/payments`, payload)
    : await api.post(`/accounts/${txnType === 'receipt' ? 'receipt' : 'payment'}`, payload);
  const serverId = response?.data?.data?.id ?? response?.data?.id ?? null;
  await upsertAccountingTransaction({
    ...txn,
    sync_status: 'synced',
    synced_at: nowIso(),
    server_id: serverId,
  });
  return { status: 'synced', serverId };
};

const syncEntry = async (entry) => {
  switch (entry.type) {
    case 'product':
      return await syncProductEntry(entry);
    case 'supplier':
      return await syncSupplierEntry(entry);
    case 'purchase':
      return await syncPurchaseEntry(entry);
    case 'purchase_return':
      return await syncPurchaseReturnEntry(entry);
    case 'accounting_txn':
      return await syncAccountingEntry(entry);
    default:
      return { status: 'synced', note: 'unsupported' };
  }
};

const ensurePurchaseQueueCoverage = async () => {
  const purchases = await getLocalPurchases();
  const unsyncedPurchases = (Array.isArray(purchases) ? purchases : []).filter((purchase) => {
    const status = normalizeStatus(purchase?.syncStatus || purchase?.sync_status || 'pending');
    return status !== 'synced';
  });
  if (!unsyncedPurchases.length) return;

  const queueEntries = await db.sync_queue.toArray();
  for (const purchase of unsyncedPurchases) {
    const purchaseId = purchase?.id;
    if (!purchaseId) continue;
    const existing = queueEntries.find(
      (entry) =>
        entry?.type === 'purchase' &&
        entry?.action === 'create' &&
        String(entry?.entityId) === String(purchaseId)
    );
    if (!existing) {
      await addInventorySyncQueueEntry({
        type: 'purchase',
        entityId: purchaseId,
        action: 'create',
        status: 'pending',
        createdAt: purchase.createdAt || purchase.created_at || nowIso(),
        updated_at: nowIso(),
      });
      continue;
    }
    const existingStatus = normalizeStatus(existing.status);
    if (existingStatus === 'synced') {
      await updateInventorySyncQueueEntry({
        ...existing,
        status: 'pending',
        updated_at: nowIso(),
      });
    }
  }
};

export const processInventorySyncQueue = async () => {
  if (!navigator.onLine) return [];
  if (isSyncing) {
    syncRerunRequested = true;
    return [];
  }
  isSyncing = true;
  const synced = [];
  try {
    await ensurePurchaseQueueCoverage();
    do {
      syncRerunRequested = false;
      const pending = await getInventorySyncQueueEntries(['pending', 'failed']);
      for (const entry of pending) {
        try {
          const processingEntry = { ...entry, status: 'processing', updated_at: nowIso() };
          await updateInventorySyncQueueEntry(processingEntry);
          const result = await syncEntry(processingEntry);
          await updateInventorySyncQueueEntry({
            ...processingEntry,
            status: 'synced',
            updated_at: nowIso(),
          });
          await addSyncLog({
            type: entry.type,
            entityId: entry.entityId,
            status: 'synced',
            message: result?.note || null,
          });
          synced.push({ ...entry, ...result, status: 'synced' });
          emitSyncEvent(entry.type);
        } catch (error) {
          const retries = (entry?.retries ?? 0) + 1;
          const shouldHoldPending =
            error?.message === 'purchase_not_synced' ||
            error?.message === 'supplier_not_synced' ||
            error?.message === 'customer_not_synced';
          await updateInventorySyncQueueEntry({
            ...entry,
            status: shouldHoldPending ? 'pending' : 'failed',
            retries,
            updated_at: nowIso(),
            last_error: error?.message || 'sync_failed',
          });
          await addSyncLog({
            type: entry.type,
            entityId: entry.entityId,
            status: shouldHoldPending ? 'pending' : 'failed',
            message: error?.message || 'sync_failed',
          });
          if (!shouldHoldPending) {
            if (entry.type === 'product') {
              await setProductSyncStatus(entry.entityId, 'failed', { last_error: error?.message || 'sync_failed' });
            } else if (entry.type === 'supplier') {
              await setSupplierSyncStatus(entry.entityId, 'failed', { last_error: error?.message || 'sync_failed' });
            } else if (entry.type === 'purchase') {
              await setPurchaseSyncStatus(entry.entityId, 'failed', { last_error: error?.message || 'sync_failed' });
            } else if (entry.type === 'purchase_return') {
              await setReturnSyncStatus(entry.entityId, 'failed', { last_error: error?.message || 'sync_failed' });
            } else if (entry.type === 'accounting_txn') {
              const txn = await getTransactionById(entry.entityId);
              if (txn) {
                await upsertAccountingTransaction({
                  ...txn,
                  sync_status: 'failed',
                  last_error: error?.message || 'sync_failed',
                });
              }
            }
          }
        }
      }
    } while (syncRerunRequested);
  } finally {
    isSyncing = false;
  }
  if (synced.length) {
    runDeltaSync().catch(() => {});
  }
  return synced;
};

export const startInventorySyncWorker = () => {
  if (syncTimer) return syncTimer;
  syncTimer = setInterval(() => {
    processInventorySyncQueue().catch(() => {});
  }, SYNC_INTERVAL_MS);
  return syncTimer;
};

export const stopInventorySyncWorker = () => {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
};

export const syncAllInventory = async () => {
  await processInventorySyncQueue();
  await runDeltaSync().catch(() => {});
};
