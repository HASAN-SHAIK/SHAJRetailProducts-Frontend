jest.mock('../utils/axios', () => ({
  post: jest.fn(),
}));

import api from '../utils/axios';
import { requestPosSyncRecoveryGrant } from './posSyncRecoveryService';

describe('Central POS sync recovery grant client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('posts exact recovery context to Central authority', async () => {
    api.post.mockResolvedValue({ data: { recovery_grant: 'signed' } });

    const result = await requestPosSyncRecoveryGrant({
      deviceId: 'device-1',
      orderId: 'ord-1',
      eventId: 'evt-1',
      reason: 'Reviewed poisoned refund event',
    });

    expect(api.post).toHaveBeenCalledWith('/auth/pos-sync-recovery-grant', {
      device_id: 'device-1',
      order_id: 'ord-1',
      event_id: 'evt-1',
      reason: 'Reviewed poisoned refund event',
    });
    expect(result).toEqual({ recovery_grant: 'signed' });
  });

  test('rejects incomplete recovery context before contacting Central', async () => {
    await expect(requestPosSyncRecoveryGrant({
      deviceId: 'device-1',
      orderId: 'ord-1',
      eventId: '',
      reason: 'reviewed',
    })).rejects.toThrow('pos_sync_recovery_context_required');

    expect(api.post).not.toHaveBeenCalled();
  });
});
