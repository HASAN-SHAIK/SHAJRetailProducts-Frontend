export const isTempEntityId = (value) => {
  const text = String(value || '').toLowerCase();
  return (
    text.startsWith('temp_') ||
    text.startsWith('temp:') ||
    text.startsWith('local_') ||
    text.startsWith('local:') ||
    text.startsWith('tmp:')
  );
};

const toFlagValue = (value, fallback = 0) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return value !== 0 ? 1 : 0;
  const raw = String(value).trim().toLowerCase();
  if (['true', 'yes', 'y', '1', 'weight', 'weighted', 'weight based', 'weight-based', 'kg', 'kgs', 'gram', 'grams'].includes(raw)) return 1;
  if (['false', 'no', 'n', '0', 'piece', 'pieces', 'piece based', 'piece-based', 'unit', 'units'].includes(raw)) return 0;
  return fallback;
};

export const normalizeApiProduct = (product) => {
  if (!product) return null;
  const rawBarcode =
    product.barcode ??
    product.barcode_number ??
    product.barcodeNumber ??
    product.product_barcode ??
    product.productBarcode ??
    null;
  const idValue = product.id ?? product.product_id ?? product.productId ?? null;
  const resolvedBarcode = rawBarcode || (idValue ? `id:${idValue}` : null);
  const resolvedId = idValue ?? resolvedBarcode;
  if (!resolvedId) return null;

  return {
    id: resolvedId,
    name: product.name ?? product.product_name ?? '',
    company: product.company ?? product.company_name ?? '',
    category: product.category ?? product.category_name ?? '',
    barcode: resolvedBarcode,
    selling_price: product.selling_price ?? product.price ?? null,
    purchase_price: product.purchase_price ?? null,
    mrp: product.mrp ?? product.mrp_price ?? null,
    hsn_code: product.hsn_code ?? null,
    gst_percentage: product.gst_percentage ?? product.gst_percent ?? null,
    is_batch_enabled: product.is_batch_enabled ?? product.batch_enabled ?? null,
    expiry_date: product.expiry_date ?? product.expiryDate ?? product.nearest_expiry_date ?? product.nearestExpiryDate ?? null,
    stock_quantity:
      product.stock_quantity ??
      product.stockQuantity ??
      product.stock ??
      product.quantity ??
      null,
    branch_id: product.branch_id ?? product.branchId ?? null,
    is_weight_based: toFlagValue(product.is_weight_based ?? product.isWeightBased ?? product.weight_based ?? product.type, 0),
    time_for_delivery: product.time_for_delivery ?? null,
    location_tag: product.location_tag ?? null,
    created_at: product.created_at ?? null,
    updated_at: product.updated_at ?? product.updatedAt ?? product.created_at ?? null,
    is_deleted: product.is_deleted ?? false,
    sync_status: product.sync_status ?? product.syncStatus ?? 'synced',
  };
};

export const normalizeApiBatch = (batch) => {
  if (!batch) return null;
  const id = batch.id ?? batch.batch_id ?? null;
  if (!id) return null;
  return {
    id,
    product_id: batch.product_id ?? batch.productId ?? null,
    branch_id: batch.branch_id ?? batch.branchId ?? null,
    batch_number: batch.batch_number ?? batch.batchNumber ?? null,
    expiry_date: batch.expiry_date ?? batch.expiryDate ?? null,
    purchase_price: batch.purchase_price ?? batch.purchasePrice ?? null,
    selling_price: batch.selling_price ?? batch.sellingPrice ?? null,
    mrp: batch.mrp ?? batch.mrp_price ?? batch.mrpPrice ?? null,
    quantity: batch.quantity ?? 0,
    quantity_remaining: batch.quantity_remaining ?? batch.quantityRemaining ?? batch.quantity ?? 0,
    sync_version: batch.sync_version ?? batch.syncVersion ?? 1,
    created_at: batch.created_at ?? batch.createdAt ?? null,
    updated_at: batch.updated_at ?? batch.updatedAt ?? batch.created_at ?? null,
    is_deleted: batch.is_deleted ?? false,
  };
};

export const buildUpdateProductPayload = (product) => {
  if (!product) return null;
  const barcodeValue = product.barcode || product.product_barcode || product.productBarcode || '';
  const payload = {
    name: product.name ?? product.product_name ?? undefined,
    company: product.company ?? product.company_name ?? undefined,
    category: product.category ?? product.category_name ?? undefined,
    purchase_price: product.purchase_price ?? undefined,
    selling_price: product.selling_price ?? undefined,
    mrp: product.mrp ?? product.mrp_price ?? undefined,
    hsn_code: product.hsn_code ?? undefined,
    gst_percentage: product.gst_percentage ?? product.gst_percent ?? undefined,
    is_batch_enabled: product.is_batch_enabled ?? undefined,
    expiry_date: product.expiry_date ?? undefined,
    is_weight_based: product.is_weight_based ?? undefined,
  };
  if (barcodeValue && !String(barcodeValue).startsWith('id:')) {
    payload.barcode = barcodeValue;
  }
  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) delete payload[key];
  });
  return payload;
};
