import { buildLocalPartialReturnLines, toMilliQuantity } from './salesReturnPartialPolicy';

describe('Sales Return local POS partial-return policy', () => {
  test('converts UI quantities to exact milli-units', () => {
    expect(toMilliQuantity(1)).toBe(1000);
    expect(toMilliQuantity('0.25')).toBe(250);
    expect(toMilliQuantity('1.234')).toBe(1234);
  });

  test('builds authoritative POS order-item lines', () => {
    expect(buildLocalPartialReturnLines([
      { orderItemId: 'item-1', quantity: 0.25 },
      { orderItemId: 'item-2', quantity: 2 },
    ])).toEqual([
      { orderItemId: 'item-1', quantityMilli: 250 },
      { orderItemId: 'item-2', quantityMilli: 2000 },
    ]);
  });

  test('fails closed when a local POS line identity is unavailable', () => {
    expect(() => buildLocalPartialReturnLines([
      { productId: 'product-only', quantity: 1 },
    ])).toThrow('partial_refund_line_identity_required');
  });

  test('rejects duplicate order-item identities', () => {
    expect(() => buildLocalPartialReturnLines([
      { orderItemId: 'item-1', quantity: 1 },
      { orderItemId: 'item-1', quantity: 0.5 },
    ])).toThrow('partial_refund_line_duplicate');
  });
});
