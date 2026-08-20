jest.mock('../../Repositories/local/posLocalApiClient', () => ({
  isLocalPosEnabled: () => true,
  localPosRequest: jest.fn(),
}));

import { localPosRequest } from '../../Repositories/local/posLocalApiClient';
import { getLocalOrderRefundReconciliation } from './refundReconciliationLocalService';

describe('local POS refund reconciliation client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('loads the orders:read-protected reconciliation endpoint', async () => {
    localPosRequest.mockResolvedValue({ order_id: 'ord 1', captured_payment_minor: 10000 });

    const result = await getLocalOrderRefundReconciliation('ord 1');

    expect(localPosRequest).toHaveBeenCalledWith('/orders/ord%201/reconciliation', { method: 'GET' });
    expect(result.order_id).toBe('ord 1');
    expect(result.captured_payment_minor).toBe(10000);
  });

  test('fails before requesting when order identity is missing', async () => {
    await expect(getLocalOrderRefundReconciliation('   ')).rejects.toThrow('order_id_required');
    expect(localPosRequest).not.toHaveBeenCalled();
  });
});