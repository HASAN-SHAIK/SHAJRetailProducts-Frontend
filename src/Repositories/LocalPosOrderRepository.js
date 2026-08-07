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

const toLocalItems = (payload = {}) => {
  const source = payload.items || payload.products || payload.order_items || [];
  return source.map((item) => {
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
};

const toLocalCreatePayload = (payload = {}) => ({
  client_order_id: String(payload.client_order_id || uuid('order')),
  customer_id: payload.customer_id || payload.customerId || payload.customer?.id || undefined,
  currency: String(payload.currency || 'INR').toUpperCase(),
  notes: payload.notes || payload.note || undefined,
  items: toLocalItems(payload),
});

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

/**
 * Local-first sales repository. It preserves every existing ApiOrderRepository
 * method and redirects the checkout-critical paths to the store-local POS
 * service only when the feature flag is enabled. Unsupported legacy actions
 * continue to use the existing central API implementation.
 */
export class LocalPosOrderRepository extends ApiOrderRepository {
  async listOrders(options = {}) {
    if (!isLocalPosEnabled()) return super.listOrders(options);
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    if (options.status) params.set('status', String(options.status));
    const payload = await localPosRequest(`/orders${params.toString() ? `?${params}` : ''}`);
    return { list: Array.isArray(payload?.items) ? payload.items : [], pagination: {} };
  }

  async getOrderDetail(orderId) {
    if (!isLocalPosEnabled()) return super.getOrderDetail(orderId);
    return localPosRequest(`/orders/${encodeURIComponent(String(orderId))}`);
  }

  async createOrder(payload, options = {}) {
    if (!isLocalPosEnabled()) return super.createOrder(payload, options);

    const order = await localPosRequest('/orders', { method: 'POST', body: toLocalCreatePayload(payload) });
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
    const completedOrder = completed?.order || completed || order;
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
