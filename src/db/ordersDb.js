import { db, saveTransactionsBulk } from '../core/db';

const normalizeOrder = (order) => ({
  id: order?.id ?? null,
  local_id: order?.local_id ?? null,
  client_order_id: order?.client_order_id ?? null,
  sync_status: order?.sync_status ?? null,
  is_offline: order?.is_offline ?? null,
  branch_id: order?.branch_id ?? null,
  products_summary: order?.products_summary ?? order?.product_summary ?? '',
  product_names: order?.product_names ?? [],
  product_count: order?.product_count ?? 0,
  customer_name: order?.customer_name ?? null,
  customer_phone: order?.customer_phone ?? order?.customer_mobile ?? null,
  customer_id: order?.customer_id ?? order?.customerId ?? null,
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
  await db.orders.bulkPut(normalized);
  return normalized.length;
};

const normalizeOrderKey = (orderId) => {
  if (orderId === null || orderId === undefined) return null;
  const raw = String(orderId);
  if (raw.startsWith('local:')) return raw;
  const asNumber = Number(orderId);
  if (Number.isFinite(asNumber)) return asNumber;
  return raw;
};

const normalizeOrderItem = (item, orderId) => ({
  ...item,
  order_id: item?.order_id ?? item?.orderId ?? orderId,
});

export const replaceAllOrders = async (orders) => {
  const list = Array.isArray(orders) ? orders : [];
  const normalized = list.map(normalizeOrder).filter((item) => item.id !== null);
  await db.orders.clear();
  if (normalized.length) {
    await db.orders.bulkPut(normalized);
  }
  return normalized.length;
};

export const getCachedOrderById = async (orderId) => {
  if (!orderId) return null;
  const key = normalizeOrderKey(orderId);
  if (key === null) return null;
  const direct = await db.orders.get(key);
  if (direct) return direct;
  if (key !== orderId) {
    return await db.orders.get(orderId);
  }
  return null;
};

export const getCachedOrderItems = async (orderId) => {
  const key = normalizeOrderKey(orderId);
  if (key === null) return [];
  try {
    return await db.order_items.where('order_id').equals(key).toArray();
  } catch {
    const all = await db.order_items.toArray();
    return all.filter((item) => String(item?.order_id) === String(orderId));
  }
};

export const replaceCachedOrderItems = async (orderId, items = []) => {
  const key = normalizeOrderKey(orderId);
  if (key === null) return 0;
  const list = Array.isArray(items) ? items : [];
  await db.order_items.where('order_id').equals(key).delete();
  if (list.length) {
    await db.order_items.bulkPut(list.map((item) => normalizeOrderItem(item, key)));
  }
  return list.length;
};

export const getCachedOrderTransactions = async (orderId) => {
  const key = normalizeOrderKey(orderId);
  if (key === null) return [];
  try {
    return await db.transactions.where('order_id').equals(key).toArray();
  } catch {
    const all = await db.transactions.toArray();
    return all.filter((txn) => String(txn?.order_id) === String(orderId));
  }
};

export const upsertOrderDetailsCache = async ({ order, items, payments } = {}) => {
  if (order) {
    await upsertOrders([order]);
  }
  if (order?.id && items) {
    await replaceCachedOrderItems(order.id, items);
  }
  if (order?.id && Array.isArray(payments) && payments.length) {
    const normalized = payments.map((payment) => ({
      ...payment,
      order_id: payment?.order_id ?? payment?.orderId ?? order.id,
    }));
    await saveTransactionsBulk(normalized);
  }
};

export const getCachedOrderDetails = async (orderId) => {
  const order = await getCachedOrderById(orderId);
  if (!order) return null;
  const items = await getCachedOrderItems(orderId);
  const payments = await getCachedOrderTransactions(orderId);
  return {
    ...order,
    items: items.length ? items : order.items || order.products || [],
    payment_history: payments,
  };
};

export const getCachedOrdersPage = async ({ page = 1, limit = 20 } = {}) => {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.max(Number(limit) || 20, 1);
  const offset = (safePage - 1) * safeLimit;

  const allOrders = await db.orders.toArray();
  const sorted = allOrders
    .slice()
    .sort((a, b) => String(b?.created_at || '').localeCompare(String(a?.created_at || '')));

  const orders = sorted.slice(offset, offset + safeLimit);
  return { orders, total: sorted.length };
};

export const getAllCachedOrders = async () => {
  return await db.orders.toArray();
};

export const getCachedOrdersByCustomer = async (customer = {}) => {
  const customerId = customer?.id ?? customer?.customer_id ?? customer?.customerId ?? null;
  const customerPhone = customer?.phone ?? customer?.mobile ?? customer?.customer_phone ?? null;
  const list = await db.orders.toArray();
  if (!list.length) return [];
  if (customerId !== null && customerId !== undefined && customerId !== '') {
    const byId = list.filter(
      (order) =>
        String(order?.customer_id ?? order?.customerId ?? '') === String(customerId)
    );
    if (byId.length) return byId;
  }
  if (customerPhone) {
    return list.filter(
      (order) =>
        String(order?.customer_phone ?? order?.customer_mobile ?? '') === String(customerPhone)
    );
  }
  return [];
};

export const clearOrdersCache = async () => {
  await db.orders.clear();
};

export const deleteOrdersByIds = async (ids = []) => {
  const list = Array.isArray(ids) ? ids.filter((id) => id !== null && id !== undefined) : [];
  if (!list.length) return 0;
  await db.orders.bulkDelete(list);
  return list.length;
};

export default {
  upsertOrders,
  replaceAllOrders,
  getCachedOrdersPage,
  getAllCachedOrders,
  clearOrdersCache,
  deleteOrdersByIds,
};
