import api from './axios';
import { saveBatchesBulk, saveCustomersBulk, saveProductsBulk, saveSessionValue, saveTransactionsBulk } from '../core/db';
import { replaceAllOrders } from '../db/ordersDb';
import { db } from '../core/db';
import { runDeltaSync } from './deltaSync';

const extractProductsPayload = (response) => {
  const payload = response?.data?.data ?? response?.data?.products ?? response?.data ?? [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.products)) return payload.products;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const getBarcodeKey = (product) =>
  product?.barcode ||
  product?.barcode_number ||
  product?.barcodeNumber ||
  product?.product_barcode ||
  product?.productBarcode ||
  product?.code ||
  product?.product_code ||
  product?.productCode ||
  null;

const normalizeProduct = (product) => {
  const barcode = getBarcodeKey(product);
  if (barcode) return { ...product, barcode };
  const idValue = product?.id ?? product?.product_id ?? product?.productId ?? null;
  if (!idValue) return null;
  return { ...product, barcode: `id:${idValue}` };
};

export const preloadProductsToIndexedDb = async (options = {}) => {
  const branchId = options?.branchId;
  const forceFull = options?.forceFull === true;
  await runDeltaSync({ branchId, forceFull }).catch(() => {});
};

const extractCustomersPayload = (response) => {
  const payload = response?.data?.data?.customers ?? response?.data?.customers ?? response?.data?.data ?? response?.data ?? [];
  return Array.isArray(payload) ? payload : [];
};

const extractOrdersPayload = (response) => {
  const payload = response?.data ?? {};
  const list =
    (Array.isArray(payload?.orders) && payload.orders) ||
    (Array.isArray(payload?.data?.orders) && payload.data.orders) ||
    (Array.isArray(payload?.data) && payload.data) ||
    (Array.isArray(payload?.results) && payload.results) ||
    [];
  return { list, pagination: payload.pagination || {} };
};

const normalizeOrderType = (order = {}) => {
  const rawType = String(order?.transaction_type ?? order?.transactionType ?? '').trim().toLowerCase();
  if (rawType === 'purchase') return 'purchase';
  if (rawType === 'sale') return 'sale';
  const hasSupplier = Boolean(order?.supplier_id || order?.supplierId || order?.supplier_name || order?.supplierName);
  return hasSupplier ? 'purchase' : 'sale';
};

const extractTransactionsPayload = (response) => {
  const payload = response?.data ?? {};
  const list = Array.isArray(payload.transactions) ? payload.transactions : [];
  return { list, page: payload.page, limit: payload.limit };
};

export const preloadCustomersToIndexedDb = async (options = {}) => {
  const limit = options?.limit || 2000;
  const res = await api.get('/customers', { params: { limit } });
  const customers = extractCustomersPayload(res);
  if (!customers.length) return 0;
  return await saveCustomersBulk(customers);
};

export const preloadOrdersToIndexedDb = async (options = {}) => {
  const limit = Math.min(Math.max(Number(options?.limit) || 200, 1), 500);
  const maxRecords = Math.min(Math.max(Number(options?.maxRecords) || 5000, 100), 20000);
  try {
    let page = 1;
    const all = [];
    while (true) {
      const res = await api.get('/orders', {
        params: {
          range: 'all',
          page,
          limit,
          sort_by: 'created_at',
          sort_order: 'asc',
        },
      });
      const { list } = extractOrdersPayload(res);
      if (!list.length) break;
      all.push(...list);
      if (all.length >= maxRecords || list.length < limit) break;
      page += 1;
    }
    if (!all.length) {
      console.warn('[orders-cache] No orders fetched from server during preload.');
      return 0;
    }

    await replaceAllOrders(all);

    const [salesStored, purchasesStored] = await Promise.all([
      db.sales_orders.toArray(),
      db.purchase_orders.toArray(),
    ]);
    await saveSessionValue('orders_last_sync', new Date().toISOString()).catch(() => {});
    console.log(
      `[orders-cache] Cached orders: fetched=${all.length}, sales=${salesStored.length}, purchases=${purchasesStored.length}`
    );
    return all.length;
  } catch (error) {
    console.error('[orders-cache] preloadOrdersToIndexedDb failed', error);
    throw error;
  }
};

export const preloadTransactionsToIndexedDb = async (options = {}) => {
  const limit = Math.min(Math.max(Number(options?.limit) || 100, 1), 100);
  const maxRecords = Math.min(Math.max(Number(options?.maxRecords) || 5000, 100), 20000);
  let page = 1;
  const all = [];
  while (true) {
    const res = await api.get('/transactions', {
      params: {
        range: 'all',
        page,
        limit,
      },
    });
    const { list } = extractTransactionsPayload(res);
    if (!list.length) break;
    all.push(...list);
    if (all.length >= maxRecords || list.length < limit) break;
    page += 1;
  }
  if (!all.length) return 0;
  await saveTransactionsBulk(all);
  return all.length;
};

const extractBatchesPayload = (response) => {
  const payload = response?.data?.batches ?? response?.data?.data?.batches ?? response?.data?.data ?? response?.data ?? [];
  return Array.isArray(payload) ? payload : [];
};

export const preloadBatchesToIndexedDb = async (options = {}) => {
  const branchId = options?.branchId;
  const forceFull = options?.forceFull === true;
  await runDeltaSync({ branchId, forceFull }).catch(() => {});
  return 0;
};

export const preloadAllCaches = async (options = {}) => {
  const branchId = options?.branchId;
  const forceFull = options?.forceFull === true;
  await runDeltaSync({ branchId, forceFull }).catch(() => {});
};
