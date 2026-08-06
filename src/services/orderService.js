import {
  createOrder as createOrderRemote,
  upsertOrderDetailsCache,
} from './local/orderLocalService';
import { buildLocalOrderFromEntry } from '../utils/offlineOrders';

const createClientOrderId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

const emitOrdersCacheUpdated = () => {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('orders-cache-updated'));
  } catch {
    // ignore browser event failures
  }
};

export const createOrder = async (payload, options = {}) => {
  const payloadWithClientId = {
    ...payload,
    client_order_id: payload?.client_order_id || createClientOrderId(),
    client_created_at: payload?.client_created_at || new Date().toISOString(),
  };
  const result = await createOrderRemote(payloadWithClientId, options);
  const normalized = result?.data ?? result;
  const orderId =
    normalized?.orderId ||
    normalized?.order_id ||
    normalized?.order?.id ||
    normalized?.data?.order_id ||
    normalized?.data?.order?.id ||
    null;
  const order = normalized?.order || normalized?.data?.order || null;
  const localFallback = buildLocalOrderFromEntry({
    id: `server:create:${payloadWithClientId.client_order_id}`,
    createdAt: payloadWithClientId.client_created_at,
    payload: payloadWithClientId,
  });
  const cachedOrder =
    order && (order.id || order.order_id)
      ? {
          ...localFallback,
          ...order,
          id: order.id || order.order_id,
          client_order_id: payloadWithClientId.client_order_id,
          transaction_type:
            order.transaction_type ||
            payloadWithClientId.transaction_type ||
            payloadWithClientId.type ||
            'sale',
          sync_status: 'synced',
          syncStatus: 'synced',
          is_offline: false,
        }
      : {
          ...localFallback,
          id: orderId || localFallback.id,
          sync_status: orderId ? 'synced' : 'pending',
          syncStatus: orderId ? 'synced' : 'pending',
          is_offline: !orderId,
        };

  await upsertOrderDetailsCache({
    order: cachedOrder,
    items: payloadWithClientId.products || [],
    payments: payloadWithClientId.payments || [],
  }).catch(() => {});
  emitOrdersCacheUpdated();

  return normalized;
};
