import api from './axios';
import { saveBatchesBulk, saveCustomersBulk, saveProductsBulk, saveTransactionsBulk } from '../core/db';
import { saveProductsCache } from './offlineProducts';
import { replaceAllOrders } from '../db/ordersDb';

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
  console.log('\u{1F4E6} Fetching products from API');
  const headers =
    branchId && branchId !== 'all' ? { 'x-branch-id': branchId } : undefined;
  const res = await api.get('/products/cache-db', { headers });
  const payload = res?.data || {};
  const products = extractProductsPayload(res);
  const batches = Array.isArray(payload?.batches) ? payload.batches : [];
  if (products.length) {
    saveProductsCache(products);
  }
  const normalizedProducts = products.map((product) => normalizeProduct(product));
  // Some tenants/products may not have barcodes. Cache whatever we can instead
  // of failing the whole preload.
  const safeProducts = normalizedProducts.filter(Boolean);
  if (!safeProducts.length) return;
  console.log('\u{1F4E5} Bulk inserting products');
  const savedCount = await saveProductsBulk(safeProducts);
  if (batches.length) {
    await saveBatchesBulk(batches).catch(() => {});
  } else {
    await preloadBatchesToIndexedDb({ branchId }).catch(() => {});
  }
  console.log('\u2705 IndexedDB fully loaded', savedCount);
};

const extractCustomersPayload = (response) => {
  const payload = response?.data?.data?.customers ?? response?.data?.customers ?? response?.data?.data ?? response?.data ?? [];
  return Array.isArray(payload) ? payload : [];
};

const extractOrdersPayload = (response) => {
  const payload = response?.data ?? {};
  const list = Array.isArray(payload.orders) ? payload.orders : [];
  return { list, pagination: payload.pagination || {} };
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
  if (!all.length) return 0;
  await replaceAllOrders(all);
  return all.length;
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
  const headers =
    branchId && branchId !== 'all' ? { 'x-branch-id': branchId } : undefined;
  const res = await api.get('/batches', { headers });
  const batches = extractBatchesPayload(res);
  if (!batches.length) return 0;
  return await saveBatchesBulk(batches);
};

export const preloadAllCaches = async (options = {}) => {
  const branchId = options?.branchId;
  await preloadProductsToIndexedDb({ branchId }).catch(() => {});
  await preloadBatchesToIndexedDb({ branchId }).catch(() => {});
  await preloadCustomersToIndexedDb().catch(() => {});
  await preloadOrdersToIndexedDb().catch(() => {});
  await preloadTransactionsToIndexedDb().catch(() => {});
};
