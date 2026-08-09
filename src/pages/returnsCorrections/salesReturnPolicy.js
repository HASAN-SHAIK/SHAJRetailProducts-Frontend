const normalizeStatus = (order) =>
  String(order?.order_status || order?.status || '').trim().toLowerCase();

const quantity = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};

export const isCompletedSale = (order) => {
  const status = normalizeStatus(order);
  return status === 'completed' || status === 'complete' || status === 'paid';
};

export const isEligibleForLocalFullRefund = ({ order, items = [], selectedItems = [] } = {}) => {
  if (!order || !isCompletedSale(order)) return false;
  if (!Array.isArray(items) || items.length === 0) return false;
  if (!Array.isArray(selectedItems) || selectedItems.length !== items.length) return false;

  const selectedByProduct = new Map(
    selectedItems.map((item) => [String(item.productId), quantity(item.quantity)])
  );

  return items.every((item) => {
    const soldQty = quantity(item.soldQty);
    const returnedQty = quantity(item.returnedQty);
    const selectedQty = selectedByProduct.get(String(item.productId)) || 0;

    if (soldQty <= 0) return false;
    if (returnedQty > 0) return false;
    return Math.abs(selectedQty - soldQty) < 0.000001;
  });
};
