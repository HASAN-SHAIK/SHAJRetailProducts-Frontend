export const getStockCount = (product) => {
  const raw =
    product?.quantity_remaining ??
    product?.quantityRemaining ??
    product?.available_quantity ??
    product?.availableQuantity ??
    product?.stock_quantity ??
    product?.stockQuantity ??
    product?.quantity ??
    product?.stock ??
    null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

export const isBatchExpired = (batch) => {
  const value = batch?.expiry_date ?? batch?.expiryDate ?? null;
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const batchDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return batchDay < todayStart;
};

export const sumBatchQuantityRemaining = (batches = []) =>
  (Array.isArray(batches) ? batches : []).reduce((sum, batch) => {
    const qty = Number(batch?.quantity_remaining ?? batch?.quantityRemaining ?? batch?.quantity ?? 0);
    return sum + (Number.isFinite(qty) ? qty : 0);
  }, 0);
