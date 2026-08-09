import { isLocalPosEnabled, localPosRequest } from '../../Repositories/local/posLocalApiClient';

export const getLocalOrderRefundReconciliation = async (orderId) => {
  if (!isLocalPosEnabled()) throw new Error('local_pos_refund_reconciliation_not_enabled');
  const normalizedOrderId = String(orderId || '').trim();
  if (!normalizedOrderId) throw new Error('order_id_required');

  return localPosRequest(`/orders/${encodeURIComponent(normalizedOrderId)}/reconciliation`, {
    method: 'GET',
  });
};
