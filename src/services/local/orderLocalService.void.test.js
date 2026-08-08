jest.mock('../../RepositoryFactory', () => ({
  getOrderRepository: jest.fn(() => ({
    deleteOrder: jest.fn(),
  })),
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
import { deleteOrder } from './orderLocalService';

describe('local POS void contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('routes local delete through the POS void endpoint with an audit reason', async () => {
    localPosRequest.mockResolvedValue({ order: { id: 'ord-1', status: 'cancelled' } });

    await deleteOrder('ord-1');

    expect(localPosRequest).toHaveBeenCalledTimes(1);
    expect(localPosRequest).toHaveBeenCalledWith('/orders/ord-1/void', {
      method: 'POST',
      body: { reason: 'Order cancelled from Orders screen' },
      approvalToken: null,
    });
    expect(requestManagerApproval).not.toHaveBeenCalled();
  });

  test('requests pos:void approval and retries exactly once with the one-use token', async () => {
    const approvalRequired = Object.assign(new Error('manager_approval_required'), {
      payload: { error: 'manager_approval_required', required_permission: 'pos:void' },
    });
    localPosRequest
      .mockRejectedValueOnce(approvalRequired)
      .mockResolvedValueOnce({ order: { id: 'ord-2', status: 'cancelled' } });
    requestManagerApproval.mockResolvedValue({ approval_token: 'void-token-1' });

    await deleteOrder('ord-2');

    expect(requestManagerApproval).toHaveBeenCalledTimes(1);
    expect(requestManagerApproval).toHaveBeenCalledWith('pos:void');
    expect(localPosRequest).toHaveBeenCalledTimes(2);
    expect(localPosRequest.mock.calls[1][1].approvalToken).toBe('void-token-1');
  });

  test('does not reinterpret refund_required as a void approval problem', async () => {
    const refundRequired = Object.assign(new Error('refund_required'), {
      payload: { error: 'refund_required', required_permission: 'pos:refund' },
    });
    localPosRequest.mockRejectedValueOnce(refundRequired);

    await expect(deleteOrder('ord-complete')).rejects.toThrow('refund_required');

    expect(requestManagerApproval).not.toHaveBeenCalled();
    expect(localPosRequest).toHaveBeenCalledTimes(1);
  });
});
