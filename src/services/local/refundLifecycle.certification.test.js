jest.mock('../../RepositoryFactory', () => ({
  getOrderRepository: () => ({}),
}));

jest.mock('../../Repositories/local/posLocalApiClient', () => ({
  isLocalPosEnabled: () => true,
  localPosRequest: jest.fn(),
}));

jest.mock('../managerApprovalService', () => ({
  requestManagerApproval: jest.fn(),
}));

jest.mock('./refundDiagnosticsEvents', () => ({
  signalRefundDiagnosticsRefresh: jest.fn(),
}));

import { localPosRequest } from '../../Repositories/local/posLocalApiClient';
import { requestManagerApproval } from '../managerApprovalService';
import { signalRefundDiagnosticsRefresh } from './refundDiagnosticsEvents';
import { refundOrder } from './orderLocalService';
import { refundOrderPartial } from './partialRefundLocalService';

const approvalRequired = () => Object.assign(new Error('manager_approval_required'), {
  payload: { error: 'manager_approval_required', required_permission: 'pos:refund' },
});

const reconciliationRequired = () => Object.assign(new Error('refund_reconciliation_required'), {
  payload: { error: 'refund_reconciliation_required' },
});

describe('manager-approved refund lifecycle certification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('full and partial refunds obtain separate one-time approvals and never reuse a prior token', async () => {
    requestManagerApproval
      .mockResolvedValueOnce({ approval_token: 'full-refund-token' })
      .mockResolvedValueOnce({ approval_token: 'partial-refund-token' });

    localPosRequest
      .mockRejectedValueOnce(approvalRequired())
      .mockResolvedValueOnce({ order: { id: 'ord-full', status: 'returned' } })
      .mockRejectedValueOnce(approvalRequired())
      .mockResolvedValueOnce({ order: { id: 'ord-partial', status: 'completed' } });

    await refundOrder('ord-full', { reason: 'Return all items' });
    await refundOrderPartial('ord-partial', {
      reason: 'Damaged item',
      returnId: 'ret-1',
      lines: [{ orderItemId: 'line-1', quantityMilli: 250 }],
    });

    expect(requestManagerApproval).toHaveBeenCalledTimes(2);
    expect(requestManagerApproval).toHaveBeenNthCalledWith(1, 'pos:refund', {
      orderId: 'ord-full', actionScope: 'refund_full'
    });
    expect(requestManagerApproval).toHaveBeenNthCalledWith(2, 'pos:refund', {
      orderId: 'ord-partial', actionScope: 'refund_partial'
    });

    expect(localPosRequest).toHaveBeenCalledTimes(4);
    expect(localPosRequest.mock.calls[1][1].approvalToken).toBe('full-refund-token');
    expect(localPosRequest.mock.calls[3][1].approvalToken).toBe('partial-refund-token');
    expect(localPosRequest.mock.calls[3][1].approvalToken).not.toBe(localPosRequest.mock.calls[1][1].approvalToken);

    expect(signalRefundDiagnosticsRefresh).toHaveBeenCalledWith('ord-full', 'full_refund_succeeded');
  });

  test('an approved request that hits reconciliation conflict fails closed without another approval loop', async () => {
    requestManagerApproval.mockResolvedValueOnce({ approval_token: 'single-use-token' });
    localPosRequest
      .mockRejectedValueOnce(approvalRequired())
      .mockRejectedValueOnce(reconciliationRequired());

    await expect(refundOrderPartial('ord-reconcile', {
      reason: 'Return item',
      returnId: 'ret-reconcile',
      lines: [{ orderItemId: 'line-1', quantityMilli: 500 }],
    })).rejects.toThrow('refund_reconciliation_required');

    expect(requestManagerApproval).toHaveBeenCalledTimes(1);
    expect(localPosRequest).toHaveBeenCalledTimes(2);
    expect(localPosRequest.mock.calls[1][1].approvalToken).toBe('single-use-token');
    expect(signalRefundDiagnosticsRefresh).toHaveBeenCalledWith(
      'ord-reconcile',
      'refund_reconciliation_required'
    );
  });

  test('invalid partial-return input fails before POS request or manager approval', async () => {
    await expect(refundOrderPartial('ord-invalid', {
      reason: 'Bad selection',
      returnId: 'ret-invalid',
      lines: [{ orderItemId: '', quantityMilli: 250 }],
    })).rejects.toThrow('partial_refund_line_invalid');

    expect(localPosRequest).not.toHaveBeenCalled();
    expect(requestManagerApproval).not.toHaveBeenCalled();
    expect(signalRefundDiagnosticsRefresh).not.toHaveBeenCalled();
  });
});