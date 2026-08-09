const toAmount = (minor) => Number(minor || 0) / 100;
const toQuantity = (milli) => Number(milli || 0) / 1000;

export const summarizeRefundReconciliation = (snapshot = {}) => {
  const capturedAmount = toAmount(snapshot.captured_payment_minor);
  const reversedAmount = toAmount(snapshot.reversed_payment_minor);
  const issuedQuantity = toQuantity(snapshot.sale_issued_quantity_milli);
  const restoredQuantity = toQuantity(snapshot.restored_quantity_milli);
  const partialRefundAmount = toAmount(snapshot.partial_return_refund_minor);
  const paymentDelta = capturedAmount - reversedAmount;
  const inventoryDelta = issuedQuantity - restoredQuantity;

  return {
    orderId: snapshot.order_id || '',
    orderStatus: snapshot.order_status || '',
    capturedAmount,
    reversedAmount,
    issuedQuantity,
    restoredQuantity,
    partialReturnOperations: Number(snapshot.partial_return_operations || 0),
    partialRefundAmount,
    paymentDelta,
    inventoryDelta,
    hasPaymentMismatch: reversedAmount > capturedAmount,
    hasInventoryMismatch: restoredQuantity > issuedQuantity,
  };
};
