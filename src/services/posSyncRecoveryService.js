import api from '../utils/axios';

const normalize = (value) => String(value || '').trim();

export const requestPosSyncRecoveryGrant = async ({ deviceId, orderId, eventId, reason }) => {
  const device_id = normalize(deviceId);
  const order_id = normalize(orderId);
  const event_id = normalize(eventId);
  const normalizedReason = normalize(reason);

  if (!device_id || !order_id || !event_id || !normalizedReason) {
    throw new Error('pos_sync_recovery_context_required');
  }

  const response = await api.post('/auth/pos-sync-recovery-grant', {
    device_id,
    order_id,
    event_id,
    reason: normalizedReason,
  });

  return response.data;
};
