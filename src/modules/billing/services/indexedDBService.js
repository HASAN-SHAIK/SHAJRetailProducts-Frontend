import { initDB } from '../../../core/db';

const PRODUCTS_STORE = 'products';
const ORDERS_STORE = 'orders';
const ORDER_ITEMS_STORE = 'order_items';
const CUSTOMERS_STORE = 'customers';
const SYNC_QUEUE_STORE = 'sync_queue';

const waitForRequest = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const waitForTransaction = (transaction) =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

const withDb = async (work) => {
  const db = await initDB();
  return await work(db);
};

const normalizeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeProduct = (product) => {
  if (!product) return null;
  const id = product.id ?? product.product_id ?? product.productId ?? null;
  const barcode =
    product.barcode ??
    product.barcode_number ??
    product.barcodeNumber ??
    product.product_barcode ??
    product.productBarcode ??
    product.code ??
    product.product_code ??
    product.productCode ??
    null;
  const resolvedId = id ?? barcode ?? null;
  if (!resolvedId) return null;
  return {
    id: resolvedId,
    name: product.name ?? product.product_name ?? '',
    company: product.company ?? product.company_name ?? product.brand ?? null,
    barcode: barcode ?? null,
    hsn_code: product.hsn_code ?? product.hsn ?? null,
    selling_price: normalizeNumber(product.selling_price ?? product.price ?? product.sellingPrice),
    gst_percentage: normalizeNumber(product.gst_percentage ?? product.gst_percent ?? product.gst),
    stock_quantity: Number.isFinite(Number(product.stock_quantity ?? product.stock ?? product.quantity))
      ? Number(product.stock_quantity ?? product.stock ?? product.quantity)
      : null,
    is_weight_based: product.is_weight_based ?? product.isWeightBased ?? 0,
  };
};

export const upsertProducts = async (products) => {
  const list = Array.isArray(products) ? products : [];
  const normalized = list.map(normalizeProduct).filter(Boolean);
  if (!normalized.length) return 0;
  await withDb(async (db) => {
    const tx = db.transaction([PRODUCTS_STORE], 'readwrite');
    const store = tx.objectStore(PRODUCTS_STORE);
    for (const entry of normalized) {
      const existing = await waitForRequest(store.get(entry.id));
      if (existing) {
        const merged = {
          ...existing,
          ...entry,
          barcode: entry.barcode ?? existing.barcode ?? null,
          company: entry.company ?? existing.company ?? null,
        };
        store.put(merged);
      } else {
        store.put(entry);
      }
    }
    await waitForTransaction(tx);
  });
  return normalized.length;
};

export const searchProducts = async (term) => {
  const value = String(term || '').trim();
  if (!value) return [];
  const needle = value.toLowerCase();
  return await withDb(async (db) => {
    const tx = db.transaction([PRODUCTS_STORE], 'readonly');
    const store = tx.objectStore(PRODUCTS_STORE);
    const list = await waitForRequest(store.getAll());
    const products = Array.isArray(list) ? list : [];
    return products.filter((product) => {
      const name = String(product?.name || '').toLowerCase();
      const company = String(product?.company || product?.company_name || product?.brand || '').toLowerCase();
      const barcode = String(product?.barcode || '').toLowerCase();
      const hsn = String(product?.hsn_code || '').toLowerCase();
      return (
        name.includes(needle) ||
        (company && company.includes(needle)) ||
        (barcode && barcode === needle) ||
        (hsn && hsn === needle)
      );
    });
  });
};

export const getProductByBarcode = async (barcode) => {
  const code = String(barcode || '').trim();
  if (!code) return null;
  return await withDb(async (db) => {
    const tx = db.transaction([PRODUCTS_STORE], 'readonly');
    const store = tx.objectStore(PRODUCTS_STORE);
    if (store.indexNames.contains('barcode')) {
      const index = store.index('barcode');
      const result = await waitForRequest(index.get(code));
      return result || null;
    }
    const result = await waitForRequest(store.get(code));
    return result || null;
  });
};

export const saveOrder = async (order) => {
  if (!order || !order.id) return null;
  await withDb(async (db) => {
    const tx = db.transaction([ORDERS_STORE], 'readwrite');
    const store = tx.objectStore(ORDERS_STORE);
    store.put(order);
    await waitForTransaction(tx);
  });
  return order;
};

export const getOrderById = async (orderId) => {
  if (!orderId) return null;
  return await withDb(async (db) => {
    const tx = db.transaction([ORDERS_STORE], 'readonly');
    const store = tx.objectStore(ORDERS_STORE);
    const result = await waitForRequest(store.get(orderId));
    return result || null;
  });
};

export const getOrdersByStatus = async (status) => {
  if (!status) return [];
  return await withDb(async (db) => {
    const tx = db.transaction([ORDERS_STORE], 'readonly');
    const store = tx.objectStore(ORDERS_STORE);
    const list = await waitForRequest(store.getAll());
    const orders = Array.isArray(list) ? list : [];
    return orders.filter((order) => order?.status === status);
  });
};

export const updateOrdersBulk = async (orders) => {
  const list = Array.isArray(orders) ? orders.filter(Boolean) : [];
  if (!list.length) return 0;
  await withDb(async (db) => {
    const tx = db.transaction([ORDERS_STORE], 'readwrite');
    const store = tx.objectStore(ORDERS_STORE);
    list.forEach((order) => store.put(order));
    await waitForTransaction(tx);
  });
  return list.length;
};

export const replaceOrderItems = async (orderId, items) => {
  if (!orderId) return 0;
  const list = Array.isArray(items) ? items : [];
  await withDb(async (db) => {
    const tx = db.transaction([ORDER_ITEMS_STORE], 'readwrite');
    const store = tx.objectStore(ORDER_ITEMS_STORE);
    if (store.indexNames.contains('order_id')) {
      const index = store.index('order_id');
      const existing = await waitForRequest(index.getAll(orderId));
      if (Array.isArray(existing)) {
        existing.forEach((entry) => store.delete(entry.id));
      }
    }
    list.forEach((item) => store.put(item));
    await waitForTransaction(tx);
  });
  return list.length;
};

export const getOrderItems = async (orderId) => {
  if (!orderId) return [];
  return await withDb(async (db) => {
    const tx = db.transaction([ORDER_ITEMS_STORE], 'readonly');
    const store = tx.objectStore(ORDER_ITEMS_STORE);
    if (store.indexNames.contains('order_id')) {
      const index = store.index('order_id');
      const list = await waitForRequest(index.getAll(orderId));
      return Array.isArray(list) ? list : [];
    }
    const list = await waitForRequest(store.getAll());
    return (Array.isArray(list) ? list : []).filter((item) => item.order_id === orderId);
  });
};

export const addSyncQueueEntry = async (entry) => {
  if (!entry) return null;
  return await withDb(async (db) => {
    const tx = db.transaction([SYNC_QUEUE_STORE], 'readwrite');
    const store = tx.objectStore(SYNC_QUEUE_STORE);
    const request = store.add(entry);
    const id = await waitForRequest(request);
    await waitForTransaction(tx);
    return { ...entry, id };
  });
};

export const updateSyncQueueEntry = async (entry) => {
  if (!entry || !entry.id) return null;
  await withDb(async (db) => {
    const tx = db.transaction([SYNC_QUEUE_STORE], 'readwrite');
    const store = tx.objectStore(SYNC_QUEUE_STORE);
    store.put(entry);
    await waitForTransaction(tx);
  });
  return entry;
};

export const getPendingSyncEntries = async () => {
  return await withDb(async (db) => {
    const tx = db.transaction([SYNC_QUEUE_STORE], 'readonly');
    const store = tx.objectStore(SYNC_QUEUE_STORE);
    const list = await waitForRequest(store.getAll());
    const entries = Array.isArray(list) ? list : [];
    return entries.filter((entry) => entry.status === 'pending');
  });
};

export const findPendingSyncEntry = async (orderId, action) => {
  if (!orderId || !action) return null;
  const pending = await getPendingSyncEntries();
  return pending.find((entry) => entry.order_id === orderId && entry.action === action) || null;
};

export const getAllCustomers = async () => {
  return await withDb(async (db) => {
    const tx = db.transaction([CUSTOMERS_STORE], 'readonly');
    const store = tx.objectStore(CUSTOMERS_STORE);
    const list = await waitForRequest(store.getAll());
    return Array.isArray(list) ? list : [];
  });
};
