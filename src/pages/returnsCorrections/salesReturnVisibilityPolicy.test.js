import {
  getRemainingReturnableQuantity,
  getReturnLineLabel,
  getReturnLineState,
} from './salesReturnVisibilityPolicy';

describe('sales return visibility policy', () => {
  test('shows untouched sale lines as fully returnable', () => {
    expect(getRemainingReturnableQuantity({ soldQty: 2, returnedQty: 0 })).toBe(2);
    expect(getReturnLineState({ soldQty: 2, returnedQty: 0 })).toEqual({
      status: 'returnable', remaining: 2, isReturnable: true,
    });
    expect(getReturnLineLabel({ soldQty: 2, returnedQty: 0 })).toBe('2 returnable');
  });

  test('shows partial history and exact remaining quantity', () => {
    expect(getReturnLineState({ soldQty: 2, returnedQty: 0.75 })).toEqual({
      status: 'partially_returned', remaining: 1.25, isReturnable: true,
    });
    expect(getReturnLineLabel({ soldQty: 2, returnedQty: 0.75 })).toBe('Partial return · 1.25 remaining');
  });

  test('marks fully returned lines as non-returnable', () => {
    expect(getReturnLineState({ soldQty: 1, returnedQty: 1 })).toEqual({
      status: 'returned', remaining: 0, isReturnable: false,
    });
    expect(getReturnLineLabel({ soldQty: 1, returnedQty: 1 })).toBe('Fully returned');
  });

  test('clamps inconsistent over-returned data to zero remaining', () => {
    expect(getRemainingReturnableQuantity({ soldQty: 1, returnedQty: 2 })).toBe(0);
    expect(getReturnLineState({ soldQty: 1, returnedQty: 2 }).isReturnable).toBe(false);
  });

  test('fails closed for missing or non-positive sold quantity', () => {
    expect(getReturnLineState({ soldQty: 0, returnedQty: 0 })).toEqual({
      status: 'not_returnable', remaining: 0, isReturnable: false,
    });
    expect(getReturnLineLabel({})).toBe('Not returnable');
  });
});
