const quantity = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};

export const getRemainingReturnableQuantity = (item) =>
  Math.max(quantity(item?.soldQty) - quantity(item?.returnedQty), 0);

export const getReturnLineState = (item) => {
  const sold = Math.max(quantity(item?.soldQty), 0);
  const returned = Math.max(quantity(item?.returnedQty), 0);
  const remaining = Math.max(sold - returned, 0);

  if (sold <= 0) {
    return { status: 'not_returnable', remaining, isReturnable: false };
  }
  if (remaining <= 0) {
    return { status: 'returned', remaining: 0, isReturnable: false };
  }
  if (returned > 0) {
    return { status: 'partially_returned', remaining, isReturnable: true };
  }
  return { status: 'returnable', remaining, isReturnable: true };
};

export const getReturnLineLabel = (item) => {
  const state = getReturnLineState(item);
  switch (state.status) {
    case 'returned':
      return 'Fully returned';
    case 'partially_returned':
      return `Partial return · ${state.remaining} remaining`;
    case 'not_returnable':
      return 'Not returnable';
    default:
      return `${state.remaining} returnable`;
  }
};
