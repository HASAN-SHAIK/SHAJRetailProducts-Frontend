import { db, validateAndPrepare } from '../../../core/db';

const normalizeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizePaymentMode = (value) => {
  const mode = String(value || '').trim().toLowerCase();
  if (mode === 'cash') return 'cash';
  if (mode === 'bank') return 'bank';
  if (mode === 'credit') return 'credit';
  if (mode === 'upi' || mode === 'card' || mode === 'wallet') return 'bank';
  return 'cash';
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
  const prepared = [];
  for (const entry of normalized) {
    prepared.push(await validateAndPrepare('product_cache', entry));
  }
  await db.products_cache.bulkPut(prepared);
  return prepared.length;
};

export const searchProducts = async (term) => {
  const value = String(term || '').trim();
  if (!value) return [];
  const needle = value.toLowerCase();
  const products = await db.products_cache.toArray();
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
};

export const getProductByBarcode = async (barcode) => {
  const code = String(barcode || '').trim();
  if (!code) return null;
  return await db.products_cache.where('barcode').equals(code).first();
};

export const saveOrder = async (order) => {
  if (!order) return null;
  const prepared = await validateAndPrepare('order', {
    transaction_type: order?.transaction_type ?? 'sale',
    payment_mode: normalizePaymentMode(order?.payment_mode ?? order?.payment_method ?? null),
    ...order,
  });
  await db.orders.put(prepared);
  return prepared;
};

export const getOrderById = async (orderId) => {
  if (!orderId) return null;
  return await db.orders.get(orderId);
};

export const getOrdersByStatus = async (status, transactionType = 'sale') => {
  if (!status) return [];
  const normalizedType = String(transactionType || 'sale').toLowerCase() === 'purchase' ? 'purchase' : 'sale';
  const orders = await db.orders.toArray();
  return orders.filter(
    (order) =>
      order?.status === status &&
      String(order?.transaction_type || '').toLowerCase() === normalizedType
  );
};

export const updateOrdersBulk = async (orders) => {
  const list = Array.isArray(orders) ? orders.filter(Boolean) : [];
  if (!list.length) return 0;
  const prepared = [];
  for (const entry of list) {
    prepared.push(await validateAndPrepare('order', entry));
  }
  await db.orders.bulkPut(prepared);
  return prepared.length;
};

export const replaceOrderItems = async (orderId, items) => {
  if (!orderId) return 0;
  const list = Array.isArray(items) ? items : [];
  if (!list.length) {
    throw new Error('Order items are required');
  }
  const prepared = [];
  for (const item of list) {
    const normalized = { ...item, order_id: item?.order_id ?? item?.orderId ?? orderId };
    prepared.push(await validateAndPrepare('order_item', normalized));
  }
  await db.transaction('rw', db.order_items, async () => {
    await db.order_items.where('order_id').equals(orderId).delete();
    await db.order_items.bulkPut(prepared);
  });
  return prepared.length;
};

export const getOrderItems = async (orderId) => {
  if (!orderId) return [];
  return await db.order_items.where('order_id').equals(orderId).toArray();
};

export const addSyncQueueEntry = async (entry) => {
  if (!entry) return null;
  const prepared = await validateAndPrepare('sync_queue', entry);
  const existing = (await db.sync_queue.toArray()).find(
    (item) => item?.payload_hash && item.payload_hash === prepared.payload_hash
  );
  if (existing) return existing;
  const id = await db.sync_queue.add(prepared);
  return { ...prepared, id };
};

export const updateSyncQueueEntry = async (entry) => {
  if (!entry || !entry.id) return null;
  const prepared = await validateAndPrepare('sync_queue', entry);
  await db.sync_queue.put(prepared);
  return prepared;
};

export const getPendingSyncEntries = async () => {
  const entries = await db.sync_queue.toArray();
  return entries.filter((entry) => entry.status === 'pending');
};

export const findPendingSyncEntry = async (orderId, action) => {
  if (!orderId || !action) return null;
  const pending = await getPendingSyncEntries();
  return pending.find((entry) => entry.order_id === orderId && entry.action === action) || null;
};

export const getAllCustomers = async () => {
  return await db.customers.toArray();
};
