import {
  saveOrder,
  getOrderById,
  getOrdersByStatus,
  updateOrdersBulk,
  replaceOrderItems,
  getOrderItems,
} from './indexedDBService';
import { calculateGST, normalizeGstMode } from '../../../services/gstService';

const ORDER_STATUS = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  COMPLETED: 'COMPLETED',
  VOID: 'VOID',
};

const nowIso = () => new Date().toISOString();

const createOrderId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `order_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const calculateLineTotals = (price, qty, gstPercent, gstMode) => {
  const { basePrice, gstAmount, total } = calculateGST({
    price,
    qty,
    gstPercent,
    gstMode
  });
  return {
    base_price: basePrice,
    gst_amount: gstAmount,
    total
  };
};

const buildOrderItems = (orderId, items, gstMode) => {
  const createdAt = nowIso();
  const mode = normalizeGstMode(gstMode);
  return (Array.isArray(items) ? items : []).map((item) => {
    const totals = calculateLineTotals(item.price, item.qty, item.gstPercent ?? item.gst_percentage ?? item.gst, mode);
    return ({
    order_id: orderId,
    product_id: item.id ?? item.product_id ?? item.productId ?? null,
    barcode: item.barcode ?? null,
    name: item.name ?? item.product_name ?? '- ',
    qty: toNumber(item.qty),
    price: toNumber(item.price),
    gst_percentage: toNumber(item.gstPercent ?? item.gst_percentage ?? item.gst),
    gst_amount: totals.gst_amount,
    base_price: totals.base_price,
    total: totals.total,
    hsn_code: item.hsn_code ?? item.hsn ?? null,
    created_at: createdAt,
  });
  });
};

const buildOrderRecord = ({
  id,
  status,
  totals,
  discountType,
  customer,
  paymentMethod,
  userId,
  branchId,
  isGSTEnabled,
  gstMode,
  createdAt,
}) => ({
  id,
  status,
  total_amount: toNumber(totals?.total),
  gst_amount: toNumber(totals?.gstAmount),
  discount: toNumber(totals?.discount),
  discount_type: discountType || 'flat',
  customer_name: customer?.name || null,
  customer_phone: customer?.phone || customer?.mobile || null,
  customer_address: customer?.address || null,
  customer_location: customer?.location || null,
  payment_method: paymentMethod || 'cash',
  is_gst_enabled: Boolean(isGSTEnabled),
  gst_mode: normalizeGstMode(gstMode),
  user_id: userId || null,
  branch_id: branchId || null,
  created_at: createdAt || nowIso(),
  updated_at: nowIso(),
});

export const getActiveOrder = async () => {
  const activeOrders = await getOrdersByStatus(ORDER_STATUS.ACTIVE);
  if (!activeOrders.length) return null;
  const sorted = activeOrders.sort(
    (a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
  );
  return sorted[0];
};

export const loadActiveOrderWithItems = async () => {
  const active = await getActiveOrder();
  if (!active) return null;
  const items = await getOrderItems(active.id);
  return { order: active, items };
};

export const saveActiveCart = async ({
  orderId,
  items,
  totals,
  discountType,
  customer,
  paymentMethod,
  userId,
  branchId,
  isGSTEnabled,
  gstMode,
}) => {
  const existing = orderId ? await getOrderById(orderId) : await getActiveOrder();
  const id = existing?.id || orderId || createOrderId();
  const record = buildOrderRecord({
    id,
    status: ORDER_STATUS.ACTIVE,
    totals,
    discountType,
    customer,
    paymentMethod,
    userId,
    branchId,
    isGSTEnabled,
    gstMode: gstMode || 'INCLUSIVE',
    createdAt: existing?.created_at,
  });
  await saveOrder(record);
  await replaceOrderItems(id, buildOrderItems(id, items, record.gst_mode));
  return record;
};

export const suspendActiveOrder = async (payload) => {
  const active = await getActiveOrder();
  const id = active?.id || payload?.orderId || createOrderId();
  const record = buildOrderRecord({
    id,
    status: ORDER_STATUS.SUSPENDED,
    totals: payload?.totals,
    discountType: payload?.discountType,
    customer: payload?.customer,
    paymentMethod: payload?.paymentMethod,
    userId: payload?.userId,
    branchId: payload?.branchId,
    isGSTEnabled: payload?.isGSTEnabled,
    gstMode: payload?.gstMode || 'INCLUSIVE',
    createdAt: active?.created_at,
  });
  await saveOrder(record);
  await replaceOrderItems(id, buildOrderItems(id, payload?.items, record.gst_mode));
  return record;
};

export const voidActiveOrder = async (payload) => {
  const active = await getActiveOrder();
  if (!active && !payload?.items?.length) return null;
  const id = active?.id || payload?.orderId || createOrderId();
  const record = buildOrderRecord({
    id,
    status: ORDER_STATUS.VOID,
    totals: payload?.totals,
    discountType: payload?.discountType,
    customer: payload?.customer,
    paymentMethod: payload?.paymentMethod,
    userId: payload?.userId,
    branchId: payload?.branchId,
    isGSTEnabled: payload?.isGSTEnabled,
    gstMode: payload?.gstMode || 'INCLUSIVE',
    createdAt: active?.created_at,
  });
  await saveOrder(record);
  await replaceOrderItems(id, buildOrderItems(id, payload?.items, record.gst_mode));
  return record;
};

export const completeOrder = async (payload) => {
  const active = await getActiveOrder();
  const id = active?.id || payload?.orderId || createOrderId();
  const record = buildOrderRecord({
    id,
    status: ORDER_STATUS.COMPLETED,
    totals: payload?.totals,
    discountType: payload?.discountType,
    customer: payload?.customer,
    paymentMethod: payload?.paymentMethod,
    userId: payload?.userId,
    branchId: payload?.branchId,
    isGSTEnabled: payload?.isGSTEnabled,
    gstMode: payload?.gstMode || 'INCLUSIVE',
    createdAt: active?.created_at,
  });
  await saveOrder(record);
  await replaceOrderItems(id, buildOrderItems(id, payload?.items, record.gst_mode));
  return record;
};

export const getSuspendedOrders = async () => {
  return await getOrdersByStatus(ORDER_STATUS.SUSPENDED);
};

export const resumeOrder = async (orderId) => {
  if (!orderId) return null;
  const order = await getOrderById(orderId);
  if (!order) return null;
  const activeOrders = await getOrdersByStatus(ORDER_STATUS.ACTIVE);
  const updatedActives = activeOrders
    .filter((entry) => entry.id !== orderId)
    .map((entry) => ({ ...entry, status: ORDER_STATUS.SUSPENDED, updated_at: nowIso() }));
  if (updatedActives.length) {
    await updateOrdersBulk(updatedActives);
  }
  const resumed = { ...order, status: ORDER_STATUS.ACTIVE, updated_at: nowIso() };
  await saveOrder(resumed);
  const items = await getOrderItems(orderId);
  return { order: resumed, items };
};

export const ORDER_STATUS_ENUM = ORDER_STATUS;
