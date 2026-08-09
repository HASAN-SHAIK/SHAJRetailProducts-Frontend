export const formatReturnQuantity = (quantityMilli) => {
  const value = Number(quantityMilli || 0) / 1000;
  return Number.isFinite(value) ? value : 0;
};

export const formatRefundAmount = (refundMinor) => {
  const value = Number(refundMinor || 0) / 100;
  return Number.isFinite(value) ? value.toFixed(2) : '0.00';
};

export const summarizeReturnHistory = (records = []) =>
  (Array.isArray(records) ? records : []).map((record) => ({
    returnId: String(record?.return_id || ''),
    approvedByUserId: String(record?.approved_by_user_id || ''),
    reason: String(record?.reason || ''),
    createdAt: String(record?.created_at || ''),
    refundAmount: formatRefundAmount(record?.refund_minor),
    lines: (Array.isArray(record?.lines) ? record.lines : []).map((line) => ({
      orderItemId: String(line?.order_item_id || ''),
      quantity: formatReturnQuantity(line?.quantity_milli),
      refundAmount: formatRefundAmount(line?.refund_minor),
    })),
  }));
