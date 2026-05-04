import { db, saveTransactionsBulk, validateAndPrepare } from '../core/db';

const normalizeOrderId = (orderId) => {
  if (orderId === null || orderId === undefined) return null;
  const raw = String(orderId);
  if (raw.startsWith('local:')) return raw;
  const asNumber = Number(orderId);
  if (Number.isFinite(asNumber)) return asNumber;
  return raw;
};

const normalizePaymentMode = (value) => {
  const mode = String(value || '').trim().toLowerCase();
  if (mode === 'cash') return 'cash';
  if (mode === 'bank') return 'bank';
  if (mode === 'credit') return 'credit';
  if (mode === 'upi' || mode === 'card' || mode === 'wallet') return 'bank';
  return 'cash';
};

const toOptionalNumber = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeTransactionType = (order = {}) => {
  const type = String(order?.transaction_type || order?.transactionType || '').trim().toLowerCase();
  if (type === 'purchase') return 'purchase';
  if (type === 'sale') return 'sale';
  const hasSupplier = Boolean(order?.supplier_id || order?.supplierId || order?.supplier_name || order?.supplierName);
  return hasSupplier ? 'purchase' : 'sale';
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
  supplier_id: order?.supplier_id ?? order?.supplierId ?? null,
  supplier_name: order?.supplier_name ?? order?.supplierName ?? null,
  total_amount: toOptionalNumber(order?.total_amount ?? order?.total_price) ?? 0,
  total: toOptionalNumber(order?.total ?? order?.total_amount ?? order?.total_price) ?? 0,
  total_paid: toOptionalNumber(order?.total_paid) ?? 0,
  returned_amount: toOptionalNumber(order?.returned_amount) ?? 0,
  balance: toOptionalNumber(order?.balance),
  payment_status: order?.payment_status ?? null,
  billing_type: order?.billing_type ?? order?.billingType ?? null,
  payment_mode: normalizePaymentMode(order?.payment_mode ?? order?.payment_method ?? null),
  transaction_type: normalizeTransactionType(order),
  payment_action: order?.payment_action ?? null,
  order_status: order?.order_status ?? null,
  is_gst_enabled: order?.is_gst_enabled === true || order?.gst_enabled === true,
  created_at: order?.created_at ?? null,
  updated_at: order?.updated_at ?? order?.updatedAt ?? order?.created_at ?? null,
  };
};
const resolveOrderType = (order = {}) => {
  return normalizeTransactionType(order);
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
  const salePrepared = prepared.filter((entry) => resolveOrderType(entry) === 'sale');
  const purchasePrepared = prepared.filter((entry) => resolveOrderType(entry) === 'purchase');
  if (salePrepared.length) await db.sales_orders.bulkPut(salePrepared);
  if (purchasePrepared.length) await db.purchase_orders.bulkPut(purchasePrepared);
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

const toNumberOrNull = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeOrderItem = (item, orderId) => {
  const quantity =
    toNumberOrNull(item?.quantity ?? item?.qty ?? item?.sold_qty ?? item?.ordered_quantity) ?? 0;
  const price =
    toNumberOrNull(
      item?.price ?? item?.selling_price ?? item?.unit_price ?? item?.rate ?? item?.mrp
    ) ?? null;
  const total =
    toNumberOrNull(item?.total ?? item?.line_total ?? item?.amount) ??
    (price !== null ? Number((price * quantity).toFixed(2)) : null);
  const productName = item?.product_name ?? item?.name ?? item?.product ?? '';

  return {
    ...item,
    order_id: item?.order_id ?? item?.orderId ?? orderId,
    product_id: item?.product_id ?? item?.productId ?? item?.id ?? null,
    product_name: productName || null,
    name: (item?.name ?? productName) || null,
    quantity,
    qty: item?.qty ?? quantity,
    price,
    selling_price: item?.selling_price ?? price,
    total,
    line_total: item?.line_total ?? total,
    returned_quantity: toNumberOrNull(item?.returned_quantity ?? item?.returned_qty) ?? 0,
    is_weight_based: item?.is_weight_based === true || item?.is_weight_based === 1,
    updated_at: item?.updated_at ?? new Date().toISOString(),
  };
};

const normalizePaymentRecord = (payment, order, index = 0) => {
  const orderId = order?.id;
  const amount = toNumberOrNull(payment?.amount ?? payment?.total_price ?? payment?.amount_paid) ?? 0;
  const createdAt =
    payment?.created_at ??
    payment?.createdAt ??
    payment?.paid_at ??
    payment?.date ??
    payment?.transaction_date ??
    order?.created_at ??
    new Date().toISOString();
  const paymentMode =
    payment?.payment_mode ??
    payment?.payment_method ??
    payment?.paymentMethod ??
    payment?.method ??
    payment?.mode ??
    order?.payment_mode ??
    order?.payment_method ??
    'cash';

  return {
    ...payment,
    id:
      payment?.id ??
      payment?.transaction_id ??
      payment?.client_payment_id ??
      `order-${orderId}-payment-${index}`,
    order_id: payment?.order_id ?? payment?.orderId ?? orderId,
    amount,
    total_price: payment?.total_price ?? amount,
    payment_mode: paymentMode,
    method: payment?.method ?? paymentMode,
    mode: payment?.mode ?? paymentMode,
    created_at: createdAt,
    paid_at: payment?.paid_at ?? createdAt,
    date: payment?.date ?? createdAt,
    txn_type: payment?.txn_type ?? payment?.txnType ?? 'payment',
    direction: payment?.direction ?? 'in',
  };
};

export const replaceAllOrders = async (orders) => {
  const list = Array.isArray(orders) ? orders : [];
  const normalized = list.map(normalizeOrder).filter((item) => item.id !== null);
  await db.transaction('rw', db.orders, db.sales_orders, db.purchase_orders, async () => {
    await db.orders.clear();
    await db.sales_orders.clear();
    await db.purchase_orders.clear();
    if (normalized.length) {
      const prepared = [];
      for (const entry of normalized) {
        prepared.push(await validateAndPrepare('order', entry));
      }
      await db.orders.bulkPut(prepared);
      const salePrepared = prepared.filter((entry) => resolveOrderType(entry) === 'sale');
      const purchasePrepared = prepared.filter((entry) => resolveOrderType(entry) === 'purchase');
      if (salePrepared.length) await db.sales_orders.bulkPut(salePrepared);
      if (purchasePrepared.length) await db.purchase_orders.bulkPut(purchasePrepared);
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
  const prepared = list.map((item) => normalizeOrderItem(item, key));
  await db.transaction('rw', db.order_items, async () => {
    await db.order_items.where('order_id').equals(key).delete();
    await db.order_items.bulkPut(prepared);
  });
  return prepared.length;
};

const getOrdersTableByType = (type = 'sale') =>
  String(type || '').toLowerCase() === 'purchase' ? db.purchase_orders : db.sales_orders;

export const getCachedOrdersByType = async (type = 'sale') => {
  const table = getOrdersTableByType(type);
  let list = await table.toArray();
  if (!Array.isArray(list) || list.length === 0) {
    const legacy = await db.orders.toArray();
    const normalizedType = String(type || '').toLowerCase() === 'purchase' ? 'purchase' : 'sale';
    const filteredLegacy = legacy.filter((row) => resolveOrderType(row) === normalizedType);
    if (filteredLegacy.length) {
      const prepared = [];
      for (const entry of filteredLegacy) {
        prepared.push(await validateAndPrepare('order', normalizeOrder(entry)));
      }
      await table.bulkPut(prepared);
      list = prepared;
    }
  }
  const sorted = (Array.isArray(list) ? list : [])
    .slice()
    .sort((a, b) => String(b?.created_at || '').localeCompare(String(a?.created_at || '')));
  return sorted;
};

export const replaceCachedOrdersByType = async (type = 'sale', orders = []) => {
  const table = getOrdersTableByType(type);
  const list = Array.isArray(orders) ? orders : [];
  const normalized = list.map(normalizeOrder).filter((item) => item.id !== null);
  await db.transaction('rw', table, async () => {
    await table.clear();
    if (!normalized.length) return;
    const prepared = [];
    for (const entry of normalized) {
      prepared.push(await validateAndPrepare('order', entry));
    }
    await table.bulkPut(prepared);
  });
  return normalized.length;
};

export const clearCachedOrdersByType = async (type = 'sale') => {
  const table = getOrdersTableByType(type);
  await table.clear();
};

export const getCachedOrderTransactions = async (orderId) => {
  const key = normalizeOrderKey(orderId);
  if (key === null) return [];
  const all = await db.transactions.toArray();
  return all.filter((txn) => {
    const directOrderId = String(txn?.order_id ?? txn?.orderId ?? '').trim();
    const referenceType = String(txn?.reference_type ?? txn?.referenceType ?? '').trim().toLowerCase();
    const referenceId = String(txn?.reference_id ?? txn?.referenceId ?? '').trim();
    const target = String(orderId).trim();
    return directOrderId === target || (referenceType === 'order' && referenceId === target);
  });
};

export const upsertOrderDetailsCache = async ({ order, items, payments } = {}) => {
  if (!order) return;
  await db.transaction('rw', db.orders, db.order_items, db.transactions, async () => {
    await upsertOrders([order]);
    if (order?.id && items) {
      await replaceCachedOrderItems(order.id, items);
    }
    if (order?.id) {
      const incomingPayments = Array.isArray(payments) ? payments : [];
      let normalizedPayments = incomingPayments
        .map((payment, index) => normalizePaymentRecord(payment, order, index))
        .filter((payment) => Number(payment?.amount || 0) > 0);

      if (normalizedPayments.length) {
        await saveTransactionsBulk(normalizedPayments);
      }
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
  await db.transaction('rw', db.orders, db.sales_orders, db.purchase_orders, async () => {
    await db.orders.clear();
    await db.sales_orders.clear();
    await db.purchase_orders.clear();
  });
};

export const deleteOrdersByIds = async (ids = []) => {
  const list = Array.isArray(ids) ? ids.filter((id) => id !== null && id !== undefined) : [];
  if (!list.length) return 0;
  await db.transaction('rw', db.orders, db.sales_orders, db.purchase_orders, async () => {
    await db.orders.bulkDelete(list);
    await db.sales_orders.bulkDelete(list);
    await db.purchase_orders.bulkDelete(list);
  });
  return list.length;
};

export default {
  upsertOrders,
  replaceAllOrders,
  getCachedOrdersByType,
  replaceCachedOrdersByType,
  clearCachedOrdersByType,
  getCachedOrdersPage,
  getAllCachedOrders,
  clearOrdersCache,
  deleteOrdersByIds,
};



