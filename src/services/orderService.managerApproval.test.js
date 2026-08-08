jest.mock('./local/orderLocalService', () => ({
  createOrder: jest.fn(),
  upsertOrderDetailsCache: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./managerApprovalService', () => ({
  requestManagerApproval: jest.fn(),
}));

jest.mock('../utils/offlineOrders', () => ({
  buildLocalOrderFromEntry: jest.fn(({ id, createdAt, payload }) => ({
    id,
    created_at: createdAt,
    client_order_id: payload.client_order_id,
    transaction_type: payload.transaction_type || payload.type || 'sale',
  })),
}));

import { createOrder as createOrderRemote } from './local/orderLocalService';
import { requestManagerApproval } from './managerApprovalService';
import { createOrder } from './orderService';

describe('orderService manager approval retry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('retries a discounted local order exactly once with the returned approval token', async () => {
    const approvalRequired = Object.assign(new Error('manager_approval_required'), {
      payload: {
        error: 'manager_approval_required',
        required_permission: 'pos:discount',
      },
    });

    createOrderRemote
      .mockRejectedValueOnce(approvalRequired)
      .mockResolvedValueOnce({ orderId: 'ord-1', order: { id: 'ord-1', status: 'paid' } });
    requestManagerApproval.mockResolvedValue({ approval_token: 'approval-token-1' });

    const result = await createOrder({
      type: 'sale',
      discount: 10,
      products: [{ product_id: 'p1', quantity: 1, price: 100 }],
    });

    expect(requestManagerApproval).toHaveBeenCalledTimes(1);
    expect(requestManagerApproval).toHaveBeenCalledWith('pos:discount');
    expect(createOrderRemote).toHaveBeenCalledTimes(2);

    const [firstPayload, firstOptions] = createOrderRemote.mock.calls[0];
    const [retryPayload, retryOptions] = createOrderRemote.mock.calls[1];
    expect(retryPayload.client_order_id).toBe(firstPayload.client_order_id);
    expect(retryPayload.client_created_at).toBe(firstPayload.client_created_at);
    expect(firstOptions.approvalToken).toBeUndefined();
    expect(retryOptions.approvalToken).toBe('approval-token-1');
    expect(result.orderId).toBe('ord-1');
  });

  test('does not loop when an approval-backed retry is rejected', async () => {
    const approvalRequired = Object.assign(new Error('manager_approval_required'), {
      payload: { error: 'manager_approval_required', required_permission: 'pos:discount' },
    });

    createOrderRemote.mockRejectedValue(approvalRequired);
    requestManagerApproval.mockResolvedValue({ approval_token: 'approval-token-1' });

    await expect(createOrder({ type: 'sale', discount: 5, products: [] })).rejects.toThrow(
      'manager_approval_required'
    );

    expect(requestManagerApproval).toHaveBeenCalledTimes(1);
    expect(createOrderRemote).toHaveBeenCalledTimes(2);
  });

  test('propagates manager cancellation without retrying the order', async () => {
    const approvalRequired = Object.assign(new Error('manager_approval_required'), {
      payload: { error: 'manager_approval_required', required_permission: 'pos:discount' },
    });
    createOrderRemote.mockRejectedValueOnce(approvalRequired);
    requestManagerApproval.mockRejectedValueOnce(new Error('manager_approval_cancelled'));

    await expect(createOrder({ type: 'sale', discount: 5, products: [] })).rejects.toThrow(
      'manager_approval_cancelled'
    );

    expect(createOrderRemote).toHaveBeenCalledTimes(1);
  });
});
