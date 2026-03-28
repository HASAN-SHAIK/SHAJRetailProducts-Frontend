import { initDB } from '../core/db';

const ORDERS_STORE = 'orders';

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

const normalizeOrder = (order) => ({
  id: order?.id ?? null,
  products_summary: order?.products_summary ?? order?.product_summary ?? '',
  product_names: order?.product_names ?? [],
  product_count: order?.product_count ?? 0,
  customer_name: order?.customer_name ?? null,
  customer_phone: order?.customer_phone ?? order?.customer_mobile ?? null,
  total_amount: order?.total_amount ?? order?.total_price ?? 0,
  total_paid: order?.total_paid ?? 0,
  returned_amount: order?.returned_amount ?? 0,
  balance: order?.balance ?? null,
  payment_status: order?.payment_status ?? null,
  payment_mode: order?.payment_mode ?? order?.payment_method ?? null,
  payment_action: order?.payment_action ?? null,
  order_status: order?.order_status ?? null,
  is_gst_enabled: order?.is_gst_enabled === true || order?.gst_enabled === true,
  created_at: order?.created_at ?? null,
});

export const upsertOrders = async (orders) => {
  const list = Array.isArray(orders) ? orders : [];
  const normalized = list.map(normalizeOrder).filter((item) => item.id !== null);
  if (!normalized.length) return 0;

  const db = await initDB();
  const transaction = db.transaction([ORDERS_STORE], 'readwrite');
  const store = transaction.objectStore(ORDERS_STORE);
  normalized.forEach((order) => store.put(order));
  await waitForTransaction(transaction);
  return normalized.length;
};

export const replaceAllOrders = async (orders) => {
  const list = Array.isArray(orders) ? orders : [];
  const normalized = list.map(normalizeOrder).filter((item) => item.id !== null);

  const db = await initDB();
  const transaction = db.transaction([ORDERS_STORE], 'readwrite');
  const store = transaction.objectStore(ORDERS_STORE);
  store.clear();
  normalized.forEach((order) => store.put(order));
  await waitForTransaction(transaction);
  return normalized.length;
};

export const getCachedOrdersPage = async ({ page = 1, limit = 20 } = {}) => {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.max(Number(limit) || 20, 1);
  const offset = (safePage - 1) * safeLimit;

  const db = await initDB();
  const transaction = db.transaction([ORDERS_STORE], 'readonly');
  const store = transaction.objectStore(ORDERS_STORE);
  const allOrders = (await waitForRequest(store.getAll())) || [];
  await waitForTransaction(transaction);

  const sorted = allOrders
    .slice()
    .sort((a, b) => String(b?.created_at || '').localeCompare(String(a?.created_at || '')));

  const orders = sorted.slice(offset, offset + safeLimit);
  return { orders, total: sorted.length };
};

export const clearOrdersCache = async () => {
  const db = await initDB();
  const transaction = db.transaction([ORDERS_STORE], 'readwrite');
  const store = transaction.objectStore(ORDERS_STORE);
  store.clear();
  await waitForTransaction(transaction);
};

export default {
  upsertOrders,
  replaceAllOrders,
  getCachedOrdersPage,
  clearOrdersCache,
};
