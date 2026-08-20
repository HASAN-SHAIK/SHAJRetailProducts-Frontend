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
import { refundOrderPartial } from './partialRefundLocalService';

describe('local POS partial-refund contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('routes item-level return facts to the existing POS refund endpoint', async () => {
    localPosRequest.mockResolvedValue({ order: { id: 'ord-1', status: 'completed' } });

    await refundOrderPartial('ord-1', {
      reason: 'Damaged item',
      returnId: 'ret-1',
      lines: [{ orderItemId: 'item-1', quantityMilli: 250 }],
    });

    expect(localPosRequest).toHaveBeenCalledWith('/orders/ord-1/refund', {
      method: 'POST',
      body: {
        reason: 'Damaged item',
        return_id: 'ret-1',
        lines: [{ order_item_id: 'item-1', quantity_milli: 250 }],
      },
      approvalToken: null,
    });
  });

  test('requests order/action-bound pos:refund approval and retries exactly once', async () => {
    const approvalRequired = Object.assign(new Error('manager_approval_required'), {
      payload: { error: 'manager_approval_required', required_permission: 'pos:refund' },
    });
    localPosRequest
      .mockRejectedValueOnce(approvalRequired)
      .mockResolvedValueOnce({ order: { id: 'ord-2', status: 'completed' } });
    requestManagerApproval.mockResolvedValue({ approval_token: 'partial-refund-token' });

    await refundOrderPartial('ord-2', {
      reason: 'Wrong size',
      returnId: 'ret-2',
      lines: [{ orderItemId: 'item-2', quantityMilli: 500 }],
    });

    expect(requestManagerApproval).toHaveBeenCalledTimes(1);
    expect(requestManagerApproval).toHaveBeenCalledWith('pos:refund', {
      orderId: 'ord-2',
      actionScope: 'refund_partial',
    });
    expect(localPosRequest).toHaveBeenCalledTimes(2);
    expect(localPosRequest.mock.calls[1][1].approvalToken).toBe('partial-refund-token');
  });

  test('signals reconciliation diagnostics when a partial refund is blocked', async () => {
    const rejected = Object.assign(new Error('refund_reconciliation_required'), {
      payload: { error: 'refund_reconciliation_required' },
    });
    localPosRequest.mockRejectedValueOnce(rejected);

    await expect(refundOrderPartial('ord-reconcile', {
      reason: 'Damaged item',
      returnId: 'ret-reconcile',
      lines: [{ orderItemId: 'item-1', quantityMilli: 250 }],
    })).rejects.toThrow('refund_reconciliation_required');

    expect(signalRefundDiagnosticsRefresh).toHaveBeenCalledWith(
      'ord-reconcile',
      'refund_reconciliation_required'
    );
    expect(requestManagerApproval).not.toHaveBeenCalled();
  });

  test('rejects malformed partial returns before consuming manager approval', async () => {
    await expect(
      refundOrderPartial('ord-3', {
        reason: 'Bad line',
        returnId: 'ret-3',
        lines: [{ orderItemId: '', quantityMilli: 100 }],
      })
    ).rejects.toThrow('partial_refund_line_invalid');

    expect(localPosRequest).not.toHaveBeenCalled();
    expect(requestManagerApproval).not.toHaveBeenCalled();
  });

  test('does not retry an already-approved request', async () => {
    const rejected = Object.assign(new Error('manager_approval_required'), {
      payload: { error: 'manager_approval_required', required_permission: 'pos:refund' },
    });
    localPosRequest.mockRejectedValueOnce(rejected);

    await expect(
      refundOrderPartial('ord-4', {
        reason: 'Return item',
        returnId: 'ret-4',
        lines: [{ orderItemId: 'item-4', quantityMilli: 1000 }],
        approvalToken: 'already-used',
      })
    ).rejects.toThrow('manager_approval_required');

    expect(requestManagerApproval).not.toHaveBeenCalled();
    expect(localPosRequest).toHaveBeenCalledTimes(1);
  });
});