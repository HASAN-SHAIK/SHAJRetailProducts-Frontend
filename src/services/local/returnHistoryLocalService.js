import { isLocalPosEnabled, localPosRequest } from '../../Repositories/local/posLocalApiClient';

export const getLocalOrderReturnHistory = async (orderId) => {
  if (!isLocalPosEnabled()) throw new Error('local_pos_return_history_not_enabled');
  const normalizedOrderId = String(orderId || '').trim();
  if (!normalizedOrderId) throw new Error('order_id_required');

  const payload = await localPosRequest(`/orders/${encodeURIComponent(normalizedOrderId)}/returns`, {
    method: 'GET',
  });

  const items = Array.isArray(payload?.items) ? payload.items : [];
  return {
    items,
    count: Number.isInteger(payload?.count) ? payload.count : items.length,
  };
};
