import { ApiOrderRepository } from './ApiOrderRepository';
import { isLocalPosEnabled, localPosRequest } from './local/posLocalApiClient';

const uuid = (prefix) => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const toMinor = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
};

const normalizeQuantityMilli = (item) => {
  if (Number.isFinite(Number(item?.quantity_milli))) return Math.round(Number(item.quantity_milli));
  const quantity = Number(item?.quantity ?? item?.qty ?? 1);
  return Math.max(1, Math.round((Number.isFinite(quantity) ? quantity : 1) * 1000));
};

const getOrderDiscountMinor = (payload = {}) => {
  const discount = payload.discount_minor !== undefined
    ? Math.round(Number(payload.discount_minor) || 0)
    : toMinor(payload.discount_total ?? payload.discount ?? payload.discount_amount ?? 0);
  return Math.max(0, discount);
};

const distributeDiscount = (items, discountMinor) => {
  if (!discountMinor || !items.length) return items;
  const grossValues = items.map((item) => Math.max(0, Math.round(item.unit_price_minor * item.quantity_milli / 1000)));
  const grossTotal = grossValues.reduce((sum, value) => sum + value, 0);
  if (grossTotal <= 0) return items;

  const cappedDiscount = Math.min(discountMinor, grossTotal);
  const shares = grossValues.map((gross) => Math.min(gross, Math.floor(cappedDiscount * gross / grossTotal)));
  let remainder = cappedDiscount - shares.reduce((sum, value) => sum + value, 0);
  for (let index = 0; index < shares.length && remainder > 0; index += 1) {
    const capacity = grossValues[index] - shares[index];
    if (capacity <= 0) continue;
    const extra = Math.min(capacity, remainder);
    shares[index] += extra;
    remainder -= extra;
  }

  return items.map((item, index) => {
    const share = shares[index] || 0;
    if (share <= 0) return item;
    return {
      ...item,
      discount_minor: Math.min(grossValues[index], Math.max(0, Number(item.discount_minor || 0) + share)),
    };
  });
};

const toLocalItems = (payload = {}) => {
  const source = payload.items || payload.products || payload.order_items || [];
  const items = source.map((item) => {
    const explicitMinor = item.unit_price_minor ?? item.price_minor;
    const priceMinor = explicitMinor !== undefined
      ? Math.round(Number(explicitMinor) || 0)
      : toMinor(item.unit_price ?? item.price ?? item.selling_price ?? item.sale_price ?? 0);
    const discountMinor = item.discount_minor !== undefined
      ? Math.round(Number(item.discount_minor) || 0)
      : toMinor(item.discount ?? item.discount_amount ?? 0);
    const taxMinor = item.tax_minor !== undefined
      ? Math.round(Number(item.tax_minor) || 0)
      : toMinor(item.tax ?? item.tax_amount ?? 0);
    const barcode = item.barcode || item.bar_code || null;
    return {
      product_id: String(item.product_id ?? item.productId ?? item.id ?? ''),
      ...(barcode ? { barcode: String(barcode) } : {}),
      quantity_milli: normalizeQuantityMilli(item),
      unit_price_minor: priceMinor,
      discount_minor: Math.max(0, discountMinor),
      tax_minor: Math.max(0, taxMinor),
    };
  });
  const hasLineDiscounts = items.some((item) => Number(item.discount_minor || 0) > 0);
  return hasLineDiscounts ? items : distributeDiscount(items, getOrderDiscountMinor(payload));
};

const toLocalCreatePayload = (payload = {}) => ({
  client_order_id: String(payload.client_order_id || uuid('order')),
  customer_id: payload.customer_id || payload.customerId || payload.customer?.id || undefined,
  currency: String(payload.currency || 'INR').toUpperCase(),
  notes: payload.notes || payload.note || undefined,
  items: toLocalItems(payload),
});

const applyLocalCatalogPriceAuthority = async (payload = {}) => {
  const sourceItems = Array.isArray(payload.items) ? payload.items : [];
  const items = await Promise.all(sourceItems.map(async (item) => {
    const productId = String(item?.product_id || '').trim();
    if (!productId) return item;

    // The local SQLite projection is authoritative for sale-time price. The UI
    // still sends the displayed price so an intentional manual change can be
    // enforced by POSService, but an unchanged catalog price is omitted from
    // the create request and resolved again inside the POS transaction.
    const product = await localPosRequest(`/catalog/products/${encodeURIComponent(productId)}`);
    const catalogPriceMinor = Number(product?.price?.amount_minor);
    const requestedPriceMinor = Number(item?.unit_price_minor);
    if (
      Number.isFinite(catalogPriceMinor) &&
      Number.isFinite(requestedPriceMinor) &&
      Math.round(catalogPriceMinor) === Math.round(requestedPriceMinor)
    ) {
      const { unit_price_minor: _catalogEcho, ...catalogOwnedItem } = item;
      return catalogOwnedItem;
    }
    return item;
  }));
  return { ...payload, items };
};

const dropMissingLocalCustomer = async (payload) => {
  const customerId = payload?.customer_id;
  if (!customerId) return payload;
  try {
    await localPosRequest(`/customers/${encodeURIComponent(String(customerId))}`);
    return payload;
  } catch (error) {
    if (error?.status === 404 || error?.payload?.error === 'customer_not_found') {
      const next = { ...payload };
      delete next.customer_id;
      return next;
    }
    throw error;
  }
};

const toPaymentInput = (payload = {}, fallbackCurrency = 'INR') => ({
  client_payment_id: String(payload.client_payment_id || payload.payment_id || uuid('payment')),
  mode: String(payload.mode || payload.payment_mode || payload.payment_method || payload.method || 'cash').toLowerCase(),
  direction: payload.direction || 'in',
  amount_minor: payload.amount_minor !== undefined
    ? Math.round(Number(payload.amount_minor) || 0)
    : toMinor(payload.amount ?? payload.amount_paid ?? payload.paid_amount ?? payload.total ?? 0),
  currency: String(payload.currency || fallbackCurrency || 'INR').toUpperCase(),
  status: payload.status || 'captured',
  reference: payload.reference || payload.transaction_id || payload.ref || undefined,
  provider: payload.provider || undefined,
});

const fromMinor = (value) => Number(value || 0) / 100;

const isRefundPayment = (payment = {}) => {
  const direction = String(payment.direction || '').toLowerCase();
  const status = String(payment.status || '').toLowerCase();
  return direction === 'out' || status === 'refunded';
};

const normalizeLocalPayment = (payment = {}) => {
  const amount = fromMinor(payment.amount_minor);
  const refund = isRefundPayment(payment);
  return {
    ...payment,
    amount,
    signed_amount: refund ? -Math.abs(amount) : amount,
    total_price: amount,
    payment_mode: payment.mode,
    payment_method: payment.mode,
    method: payment.mode,
    date: payment.created_at,
    paid_at: payment.created_at,
    txn_type: refund ? 'refund' : 'receipt',
  };
};

const normalizeLocalItem = (item = {}) => ({
  ...item,
  name: item.product_name,
  quantity: Number(item.quantity_milli || 0) / 1000,
  qty: Number(item.quantity_milli || 0) / 1000,
  price: fromMinor(item.unit_price_minor),
  selling_price: fromMinor(item.unit_price_minor),
  total: fromMinor(item.line_total_minor),
  line_total: fromMinor(item.line_total_minor),
});

const normalizeLocalOrder = (order = {}, { payments = [], paymentSummary = null, receipt = null } = {}) => {
  const normalizedPayments = (Array.isArray(payments) ? payments : []).map(normalizeLocalPayment);
  const status = paymentSummary?.order_status || order.status;
  const netPaidMinor = paymentSummary?.paid_minor ?? normalizedPayments.reduce((sum, payment) => {
    const amountMinor = Number(payment?.amount_minor || 0);
    return isRefundPayment(payment) ? sum - amountMinor : sum + amountMinor;
  }, 0);
  const grossPaidMinor = normalizedPayments.reduce((sum, payment) => {
    const amountMinor = Number(payment?.amount_minor || 0);
    return isRefundPayment(payment) ? sum : sum + amountMinor;
  }, 0);
  const returnedMinor = normalizedPayments.reduce((sum, payment) => {
    const amountMinor = Number(payment?.amount_minor || 0);
    return isRefundPayment(payment) ? sum + amountMinor : sum;
  }, 0);
  const effectiveNetPaidMinor = !paymentSummary && netPaidMinor === 0 && status === 'paid'
    ? Number(order.total_minor || 0)
    : netPaidMinor;
  const netSaleMinor = Math.max(Number(order.total_minor || 0) - returnedMinor, 0);
  const balanceMinor = returnedMinor > 0 || paymentSummary?.balance_minor == null
    ? Math.max(netSaleMinor - effectiveNetPaidMinor, 0)
    : Math.max(Number(paymentSummary.balance_minor || 0), 0);
  return {
    ...order,
    branch_id: order.branch_id || order.store_id,
    transaction_type: 'sale',
    order_type: 'sale',
    order_status: status,
    payment_status: balanceMinor <= 0 && Number(order.total_minor || 0) > 0
      ? 'paid'
      : effectiveNetPaidMinor > 0 || grossPaidMinor > 0
        ? 'partial'
        : 'pending',
    payment_mode: normalizedPayments[0]?.payment_mode || 'cash',
    total_amount: fromMinor(order.total_minor),
    total_price: fromMinor(order.total_minor),
    total: fromMinor(order.total_minor),
    subtotal: fromMinor(order.subtotal_minor),
    discount: fromMinor(order.discount_minor),
    tax: fromMinor(order.tax_minor),
    total_paid: fromMinor(grossPaidMinor || effectiveNetPaidMinor),
    paid_amount: fromMinor(grossPaidMinor || effectiveNetPaidMinor),
    net_paid: fromMinor(effectiveNetPaidMinor),
    returned_amount: fromMinor(returnedMinor),
    balance: fromMinor(balanceMinor),
    products: (Array.isArray(order.items) ? order.items : []).map(normalizeLocalItem),
    items: (Array.isArray(order.items) ? order.items : []).map(normalizeLocalItem),
    payment_history: normalizedPayments,
    payments: normalizedPayments,
    receipt: receipt || undefined,
    receipt_number: receipt?.receipt_number,
    receipt_snapshot: receipt?.snapshot,
    receipt_snapshot_sha256: receipt?.snapshot_sha256,
  };
};

/**
 * Local-first sales repository. It preserves every existing ApiOrderRepository
 * method and redirects the checkout-critical paths to the store-local POS
 * service only when the feature flag is enabled.
 */
export class LocalPosOrderRepository extends ApiOrderRepository {
  async listOrders(options = {}) {
    if (!isLocalPosEnabled()) return super.listOrders(options);
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    if (options.page) params.set('page', String(options.page));
    if (options.offset) params.set('offset', String(options.offset));
    if (options.status) params.set('status', String(options.status));
    const payload = await localPosRequest(`/orders${params.toString() ? `?${params}` : ''}`);
    return {
      list: (Array.isArray(payload?.items) ? payload.items : []).map((order) => normalizeLocalOrder(order)),
      pagination: {
        page: options.page || 1,
        limit: options.limit || payload?.count || 0,
        total_records: payload?.count,
      },
    };
  }

  async getOrderDetail(orderId) {
    if (!isLocalPosEnabled()) return super.getOrderDetail(orderId);
    const encoded = encodeURIComponent(String(orderId));
    const order = await localPosRequest(`/orders/${encoded}`);
    const paymentsPayload = await localPosRequest(`/orders/${encoded}/payments`);
    let receipt = null;
    try {
      receipt = await localPosRequest(`/orders/${encoded}/receipt`);
    } catch (error) {
      if (error?.status !== 404 && error?.payload?.error !== 'receipt_not_found') throw error;
    }
    return normalizeLocalOrder(order, {
      payments: paymentsPayload?.items || [],
      paymentSummary: paymentsPayload?.summary || null,
      receipt,
    });
  }

  async createOrder(payload, options = {}) {
    if (!isLocalPosEnabled()) return super.createOrder(payload, options);

    const localCreatePayload = toLocalCreatePayload(payload);
    const customerCheckedPayload = await dropMissingLocalCustomer(localCreatePayload);
    const createPayload = await applyLocalCatalogPriceAuthority(customerCheckedPayload);
    if (process.env.NODE_ENV === 'development') {
      console.info('[POS order payload]', JSON.stringify({
        customer_id: createPayload.customer_id || null,
        itemCount: createPayload.items.length,
        items: createPayload.items.map((item) => ({
          product_id: item.product_id,
          barcode: item.barcode || null,
          quantity_milli: item.quantity_milli,
          unit_price_minor: item.unit_price_minor ?? null,
          discount_minor: item.discount_minor,
          tax_minor: item.tax_minor,
        })),
      }));
    }
    const order = normalizeLocalOrder(await localPosRequest('/orders', {
      method: 'POST',
      body: createPayload,
      approvalToken: options.approvalToken || null,
    }));
    const orderId = order?.id;
    if (!orderId) throw new Error('local_pos_order_id_missing');

    const payments = Array.isArray(payload?.payments) ? payload.payments : [];
    for (const payment of payments) {
      const input = toPaymentInput(payment, order.currency || payload.currency || 'INR');
      if (input.amount_minor <= 0) continue;
      await localPosRequest(`/orders/${encodeURIComponent(String(orderId))}/payments`, {
        method: 'POST', body: input,
      });
    }

    if (options.deferCompletion === true) {
      return { order, orderId, data: order, response: null };
    }

    const completed = await localPosRequest(`/orders/${encodeURIComponent(String(orderId))}/complete`, { method: 'POST' });
    const completedOrder = normalizeLocalOrder(completed?.order || completed || order, { receipt: completed?.receipt || null });
    return {
      order: completedOrder,
      orderId,
      receipt: completed?.receipt || null,
      data: completed,
      response: null,
    };
  }

  async markOrderPaid(payload = {}) {
    if (!isLocalPosEnabled()) return super.markOrderPaid(payload);
    const orderId = payload.order_id || payload.orderId || payload.id;
    if (!orderId) throw new Error('order_id_required');
    return localPosRequest(`/orders/${encodeURIComponent(String(orderId))}/payments`, {
      method: 'POST', body: toPaymentInput(payload),
    });
  }

  async completeOrder(orderId) {
    if (!isLocalPosEnabled()) throw new Error('local_pos_not_enabled');
    return localPosRequest(`/orders/${encodeURIComponent(String(orderId))}/complete`, { method: 'POST' });
  }
}
