jest.mock('../../Repositories/local/posLocalApiClient', () => ({
  isLocalPosEnabled: () => true,
  localPosRequest: jest.fn(),
}));

jest.mock('../../utils/device', () => ({
  getDeviceId: () => 'device-1',
}));

jest.mock('../posSyncRecoveryService', () => ({
  requestPosSyncRecoveryGrant: jest.fn(),
}));

import { localPosRequest } from '../../Repositories/local/posLocalApiClient';
import { requestPosSyncRecoveryGrant } from '../posSyncRecoveryService';
import { recoverLocalRefundSync } from './refundSyncRecoveryLocalService';

describe('Central-authorized local refund sync recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('obtains an exact Central grant before invoking the POS recovery route', async () => {
    requestPosSyncRecoveryGrant.mockResolvedValue({
      recovery_grant: 'signed-recovery-grant',
      recovery_id: 'recovery-1',
      device_id: 'device-1',
      order_id: 'ord-1',
      event_id: 'evt-dead-1',
    });
    localPosRequest.mockResolvedValue({ recovery_id: 'recovery-1', status: 'pending' });

    const result = await recoverLocalRefundSync({
      orderId: 'ord-1',
      eventId: 'evt-dead-1',
      reason: 'Manager reviewed poisoned refund event',
    });

    expect(requestPosSyncRecoveryGrant).toHaveBeenCalledWith({
      deviceId: 'device-1',
      orderId: 'ord-1',
      eventId: 'evt-dead-1',
      reason: 'Manager reviewed poisoned refund event',
    });
    expect(localPosRequest).toHaveBeenCalledWith('/orders/ord-1/sync-recovery', {
      method: 'POST',
      body: { grant: 'signed-recovery-grant' },
    });
    expect(result).toEqual({ recovery_id: 'recovery-1', status: 'pending' });
  });

  test('fails before Central or POS when exact dead-letter identity or reason is missing', async () => {
    await expect(recoverLocalRefundSync({ orderId: 'ord-1', eventId: '', reason: 'reviewed' }))
      .rejects.toThrow('dead_letter_event_id_required');
    await expect(recoverLocalRefundSync({ orderId: 'ord-1', eventId: 'evt-1', reason: '' }))
      .rejects.toThrow('sync_recovery_reason_required');

    expect(requestPosSyncRecoveryGrant).not.toHaveBeenCalled();
    expect(localPosRequest).not.toHaveBeenCalled();
  });

  test('fails closed when the Central response scope does not match the requested poisoned fact', async () => {
    requestPosSyncRecoveryGrant.mockResolvedValue({
      recovery_grant: 'signed-recovery-grant',
      device_id: 'device-1',
      order_id: 'ord-1',
      event_id: 'evt-other',
    });

    await expect(recoverLocalRefundSync({
      orderId: 'ord-1',
      eventId: 'evt-dead-1',
      reason: 'reviewed',
    })).rejects.toThrow('sync_recovery_grant_scope_mismatch');

    expect(localPosRequest).not.toHaveBeenCalled();
  });

  test('never falls back to POS recovery when Central authorization fails', async () => {
    requestPosSyncRecoveryGrant.mockRejectedValue(new Error('POS_SYNC_RECOVERY_FORBIDDEN'));

    await expect(recoverLocalRefundSync({
      orderId: 'ord-1',
      eventId: 'evt-dead-1',
      reason: 'reviewed',
    })).rejects.toThrow('POS_SYNC_RECOVERY_FORBIDDEN');

    expect(localPosRequest).not.toHaveBeenCalled();
  });
});