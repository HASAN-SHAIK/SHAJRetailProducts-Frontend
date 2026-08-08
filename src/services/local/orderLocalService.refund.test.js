jest.mock('../../RepositoryFactory', () => ({
  getOrderRepository: jest.fn(() => ({})),
}));

jest.mock('../../Repositories/local/posLocalApiClient', () => ({
  isLocalPosEnabled: jest.fn(() => true),
  localPosRequest: jest.fn(),
}));

jest.mock('../managerApprovalService', () => ({
  requestManagerApproval: jest.fn(),
}));

import { localPosRequest } from '../../Repositories/local/posLocalApiClient';
import { requestManagerApproval } from '../managerApprovalService';
import { refundOrder } from './orderLocalService';

describe('local POS full-refund contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('routes a full-sale refund to the POS refund endpoint with a required reason', async () => {
    localPosRequest.mockResolvedValue({ order: { id: 'ord-1', status: 'returned' } });

    await refundOrder('ord-1', { reason: 'Customer returned all items' });

    expect(localPosRequest).toHaveBeenCalledTimes(1);
    expect(localPosRequest).toHaveBeenCalledWith('/orders/ord-1/refund', {
      method: 'POST',
      body: { reason: 'Customer returned all items' },
      approvalToken: null,
    });
    expect(requestManagerApproval).not.toHaveBeenCalled();
  });

  test('requests pos:refund approval and retries exactly once with the one-use token', async () => {
    const approvalRequired = Object.assign(new Error('manager_approval_required'), {
      payload: { error: 'manager_approval_required', required_permission: 'pos:refund' },
    });
    localPosRequest
      .mockRejectedValueOnce(approvalRequired)
      .mockResolvedValueOnce({ order: { id: 'ord-2', status: 'returned' } });
    requestManagerApproval.mockResolvedValue({ approval_token: 'refund-token-1' });

    await refundOrder('ord-2', { reason: 'Full return' });

    expect(requestManagerApproval).toHaveBeenCalledTimes(1);
    expect(requestManagerApproval).toHaveBeenCalledWith('pos:refund');
    expect(localPosRequest).toHaveBeenCalledTimes(2);
    expect(localPosRequest.mock.calls[1][1].approvalToken).toBe('refund-token-1');
  });

  test('fails before making a request when refund reason is missing', async () => {
    await expect(refundOrder('ord-3', { reason: '   ' })).rejects.toThrow('refund_reason_required');
    expect(localPosRequest).not.toHaveBeenCalled();
    expect(requestManagerApproval).not.toHaveBeenCalled();
  });

  test('does not retry a failed request that already used an approval token', async () => {
    const rejected = Object.assign(new Error('manager_approval_required'), {
      payload: { error: 'manager_approval_required', required_permission: 'pos:refund' },
    });
    localPosRequest.mockRejectedValueOnce(rejected);

    await expect(
      refundOrder('ord-4', { reason: 'Full return', approvalToken: 'already-used-token' })
    ).rejects.toThrow('manager_approval_required');

    expect(requestManagerApproval).not.toHaveBeenCalled();
    expect(localPosRequest).toHaveBeenCalledTimes(1);
  });
});
