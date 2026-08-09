import { isLocalPosEnabled, localPosRequest } from '../../Repositories/local/posLocalApiClient';
import { getDeviceId } from '../../utils/device';
import { requestPosSyncRecoveryGrant } from '../posSyncRecoveryService';

const normalize = (value) => String(value || '').trim();

export const recoverLocalRefundSync = async ({ orderId, eventId, reason }) => {
  if (!isLocalPosEnabled()) throw new Error('local_pos_recovery_not_enabled');

  const normalizedOrderId = normalize(orderId);
  const normalizedEventId = normalize(eventId);
  const normalizedReason = normalize(reason);
  if (!normalizedOrderId) throw new Error('order_id_required');
  if (!normalizedEventId) throw new Error('dead_letter_event_id_required');
  if (!normalizedReason) throw new Error('sync_recovery_reason_required');

  const deviceId = normalize(getDeviceId());
  if (!deviceId) throw new Error('device_id_required');

  const grantPayload = await requestPosSyncRecoveryGrant({
    deviceId,
    orderId: normalizedOrderId,
    eventId: normalizedEventId,
    reason: normalizedReason,
  });

  const recoveryGrant = normalize(grantPayload?.recovery_grant);
  if (!recoveryGrant) throw new Error('sync_recovery_grant_missing');
  if (
    normalize(grantPayload?.device_id) !== deviceId ||
    normalize(grantPayload?.order_id) !== normalizedOrderId ||
    normalize(grantPayload?.event_id) !== normalizedEventId
  ) {
    throw new Error('sync_recovery_grant_scope_mismatch');
  }

  return localPosRequest(`/orders/${encodeURIComponent(normalizedOrderId)}/sync-recovery`, {
    method: 'POST',
    body: { grant: recoveryGrant },
  });
};
