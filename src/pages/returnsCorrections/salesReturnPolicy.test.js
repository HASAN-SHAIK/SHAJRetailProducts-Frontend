import { isCompletedSale, isEligibleForLocalFullRefund } from './salesReturnPolicy';

describe('sales return local POS refund policy', () => {
  const order = { id: 'ord-1', order_status: 'completed' };
  const items = [
    { productId: 'p1', soldQty: 2, returnedQty: 0 },
    { productId: 'p2', soldQty: 1, returnedQty: 0 },
  ];

  test('recognizes completed/paid local sale states only', () => {
    expect(isCompletedSale({ status: 'completed' })).toBe(true);
    expect(isCompletedSale({ order_status: 'paid' })).toBe(true);
    expect(isCompletedSale({ order_status: 'returned' })).toBe(false);
    expect(isCompletedSale({ order_status: 'pending' })).toBe(false);
  });

  test('allows POS full refund only when every sold quantity is selected', () => {
    expect(isEligibleForLocalFullRefund({
      order,
      items,
      selectedItems: [
        { productId: 'p1', quantity: 2 },
        { productId: 'p2', quantity: 1 },
      ],
    })).toBe(true);
  });

  test('rejects partial item selection', () => {
    expect(isEligibleForLocalFullRefund({
      order,
      items,
      selectedItems: [
        { productId: 'p1', quantity: 1 },
        { productId: 'p2', quantity: 1 },
      ],
    })).toBe(false);
  });

  test('rejects bills with any prior returned quantity', () => {
    expect(isEligibleForLocalFullRefund({
      order,
      items: [{ productId: 'p1', soldQty: 2, returnedQty: 1 }],
      selectedItems: [{ productId: 'p1', quantity: 1 }],
    })).toBe(false);
  });

  test('treats separate batches of the same product as distinct sale lines', () => {
    const batchItems = [
      { productId: 'p1', batchId: 'b1', soldQty: 1, returnedQty: 0 },
      { productId: 'p1', batchId: 'b2', soldQty: 2, returnedQty: 0 },
    ];

    expect(isEligibleForLocalFullRefund({
      order,
      items: batchItems,
      selectedItems: [
        { productId: 'p1', batchId: 'b1', quantity: 1 },
        { productId: 'p1', batchId: 'b2', quantity: 2 },
      ],
    })).toBe(true);

    expect(isEligibleForLocalFullRefund({
      order,
      items: batchItems,
      selectedItems: [
        { productId: 'p1', batchId: 'b1', quantity: 2 },
        { productId: 'p1', batchId: 'b2', quantity: 1 },
      ],
    })).toBe(false);
  });

  test('rejects non-completed sales', () => {
    expect(isEligibleForLocalFullRefund({
      order: { id: 'ord-1', order_status: 'pending' },
      items,
      selectedItems: [
        { productId: 'p1', quantity: 2 },
        { productId: 'p2', quantity: 1 },
      ],
    })).toBe(false);
  });
});
