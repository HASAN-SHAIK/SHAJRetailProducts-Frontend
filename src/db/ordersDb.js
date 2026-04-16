import { db, saveTransactionsBulk, validateAndPrepare } from '../core/db';

const normalizeOrderId = (orderId) => {
  if (orderId === null || orderId === undefined) return null;
  const raw = String(orderId);
  if (raw.startsWith('local:')) return raw;
  const asNumber = Number(orderId);
  if (Number.isFinite(asNumber)) return asNumber;
  return raw;
};

const normalizeOrder = (order) => {
  const normalizedId = normalizeOrderId(order?.id ?? null);
  const isLocalId = typeof normalizedId === 'string' && normalizedId.startsWith('local:');
  const isOffline = order?.is_offline === true || isLocalId;
  const incomingSyncStatus = order?.sync_status ?? order?.syncStatus;
  const syncStatus =
    incomingSyncStatus === undefined || incomingSyncStatus === null || incomingSyncStatus === ''
      ? isOffline
        ? 'pending'
        : 'synced'
      : !isOffline && incomingSyncStatus === 'pending'
        ? 'synced'
        : incomingSyncStatus;

  return {
  id: normalizedId,
  local_id: order?.local_id ?? null,
  client_order_id: order?.client_order_id ?? null,
  sync_status: syncStatus,
  is_offline: isOffline,
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
  billing_type: order?.billing_type ?? order?.billingType ?? null,
  payment_mode: order?.payment_mode ?? order?.payment_method ?? null,
  payment_action: order?.payment_action ?? null,
  order_status: order?.order_status ?? null,
  is_gst_enabled: order?.is_gst_enabled === true || order?.gst_enabled === true,
  created_at: order?.created_at ?? null,
  };
};

export const upsertOrders = async (orders) => {
  const list = Array.isArray(orders) ? orders : [];
  const normalized = list.map(normalizeOrder).filter((item) => item.id !== null);
  if (!normalized.length) return 0;
  const prepared = [];
  for (const entry of normalized) {
    if (
      entry?.client_order_id &&
      entry?.is_offline !== true &&
      !(typeof entry.id === 'string' && entry.id.startsWith('local:'))
    ) {
      // Remove local shadow row once server order is available.
      await db.orders.delete(`local:${entry.client_order_id}`).catch(() => {});
    }
    prepared.push(await validateAndPrepare('order', entry));
  }
  await db.orders.bulkPut(prepared);
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
  await db.transaction('rw', db.orders, async () => {
    await db.orders.clear();
    if (normalized.length) {
      const prepared = [];
      for (const entry of normalized) {
        prepared.push(await validateAndPrepare('order', entry));
      }
      await db.orders.bulkPut(prepared);
    }
  });
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
  if (!list.length) {
    throw new Error('Order items are required');
  }
  const prepared = [];
  for (const item of list) {
    const normalized = normalizeOrderItem(item, key);
    prepared.push(await validateAndPrepare('order_item', normalized));
  }
  await db.transaction('rw', db.order_items, async () => {
    await db.order_items.where('order_id').equals(key).delete();
    await db.order_items.bulkPut(prepared);
  });
  return prepared.length;
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
  if (!order) return;
  await db.transaction('rw', db.orders, db.order_items, db.transactions, async () => {
    await upsertOrders([order]);
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
  });
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
  const list = await db.orders.toArray();
  if (!Array.isArray(list) || list.length <= 1) return list;
  const repaired = list.map((order) => {
    const normalizedId = normalizeOrderId(order?.id ?? null);
    const isLocalId = typeof normalizedId === 'string' && normalizedId.startsWith('local:');
    if (!isLocalId && order?.is_offline === true) {
      return {
        ...order,
        is_offline: false,
        sync_status: 'synced',
      };
    }
    return order;
  });
  const deduped = new Map();
  for (const order of repaired) {
    const key = String(normalizeOrderId(order?.id ?? null));
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, order);
      continue;
    }
    const prevTime = new Date(existing?.updated_at || existing?.created_at || 0).getTime();
    const nextTime = new Date(order?.updated_at || order?.created_at || 0).getTime();
    if (nextTime >= prevTime) {
      deduped.set(key, order);
    }
  }
  return Array.from(deduped.values());
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
