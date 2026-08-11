jest.mock('../../Repositories/local/posLocalApiClient', () => ({
  isLocalPosEnabled: jest.fn(() => true),
  localPosRequest: jest.fn(),
}));

import { isLocalPosEnabled, localPosRequest } from '../../Repositories/local/posLocalApiClient';
import { getLocalTransactionSyncStatus } from './transactionSyncStatusLocalService';

describe('local POS transaction sync status client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isLocalPosEnabled.mockReturnValue(true);
  });

  test('reads the exact order durable reconciliation snapshot without mutation', async () => {
    localPosRequest.mockResolvedValue({
      order_id: 'order-1',
      unpublished_sync_facts: 1,
      dead_letter_sync_facts: 0,
    });

    await expect(getLocalTransactionSyncStatus(' order-1 ')).resolves.toEqual({
      order_id: 'order-1',
      unpublished_sync_facts: 1,
      dead_letter_sync_facts: 0,
    });

    expect(localPosRequest).toHaveBeenCalledWith('/orders/order-1/reconciliation', {
      method: 'GET',
    });
  });

  test('fails before any request when local POS or order scope is unavailable', async () => {
    await expect(getLocalTransactionSyncStatus('   ')).rejects.toThrow('order_id_required');
    expect(localPosRequest).not.toHaveBeenCalled();

    isLocalPosEnabled.mockReturnValue(false);
    await expect(getLocalTransactionSyncStatus('order-1'))
      .rejects.toThrow('local_pos_transaction_sync_status_not_enabled');
    expect(localPosRequest).not.toHaveBeenCalled();
  });
});
