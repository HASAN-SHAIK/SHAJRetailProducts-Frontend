export const toMilliQuantity = (value) => {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  return Math.round(quantity * 1000);
};

export const buildLocalPartialReturnLines = (selectedItems = []) => {
  if (!Array.isArray(selectedItems) || selectedItems.length === 0) {
    throw new Error('partial_refund_lines_required');
  }

  const seen = new Set();
  return selectedItems.map((item) => {
    const orderItemId = String(item?.orderItemId || '').trim();
    const quantityMilli = toMilliQuantity(item?.quantity);
    if (!orderItemId || quantityMilli <= 0) {
      throw new Error('partial_refund_line_identity_required');
    }
    if (seen.has(orderItemId)) {
      throw new Error('partial_refund_line_duplicate');
    }
    seen.add(orderItemId);
    return { orderItemId, quantityMilli };
  });
};
