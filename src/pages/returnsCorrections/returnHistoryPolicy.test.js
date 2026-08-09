import { formatRefundAmount, formatReturnQuantity, summarizeReturnHistory } from './returnHistoryPolicy';

describe('Sales Return history presentation policy', () => {
  test('converts POS milli/minor units for operator display', () => {
    expect(formatReturnQuantity(1250)).toBe(1.25);
    expect(formatRefundAmount(2599)).toBe('25.99');
  });

  test('preserves manager, reason, operation and line audit facts', () => {
    expect(summarizeReturnHistory([{
      return_id: 'ret-1',
      approved_by_user_id: 'manager-1',
      reason: 'Damaged item',
      refund_minor: 2500,
      created_at: '2026-08-09T10:00:00Z',
      lines: [{ order_item_id: 'item-1', quantity_milli: 250, refund_minor: 2500 }],
    }])).toEqual([{
      returnId: 'ret-1',
      approvedByUserId: 'manager-1',
      reason: 'Damaged item',
      createdAt: '2026-08-09T10:00:00Z',
      refundAmount: '25.00',
      lines: [{ orderItemId: 'item-1', quantity: 0.25, refundAmount: '25.00' }],
    }]);
  });

  test('treats missing history as empty rather than fabricating entries', () => {
    expect(summarizeReturnHistory(undefined)).toEqual([]);
  });
});
