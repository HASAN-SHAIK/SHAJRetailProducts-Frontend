import { isLocalPosEnabled, localPosRequest } from '../../Repositories/local/posLocalApiClient';

export const getLocalTransactionSyncStatus = async (orderId) => {
  if (!isLocalPosEnabled()) throw new Error('local_pos_transaction_sync_status_not_enabled');

  const normalizedOrderId = String(orderId || '').trim();
  if (!normalizedOrderId) throw new Error('order_id_required');

  return localPosRequest(`/orders/${encodeURIComponent(normalizedOrderId)}/reconciliation`, {
    method: 'GET',
  });
};
