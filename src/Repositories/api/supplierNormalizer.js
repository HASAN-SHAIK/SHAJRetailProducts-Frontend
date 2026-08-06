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

export const normalizeApiSupplier = (supplier) => {
  if (!supplier) return null;
  const id = supplier.id ?? supplier.supplier_id ?? null;
  if (!id) return null;
  return {
    id,
    name: supplier.name ?? supplier.supplier_name ?? '',
    name_lower: String(supplier.name ?? supplier.supplier_name ?? '').toLowerCase(),
    mobile: supplier.mobile ?? supplier.phone ?? null,
    email: supplier.email ?? null,
    address: supplier.address ?? null,
    gst_number: supplier.gst_number ?? null,
    credit_limit: supplier.credit_limit ?? 0,
    current_balance: supplier.current_balance ?? 0,
    branch_id: supplier.branch_id ?? supplier.branchId ?? null,
    is_active: supplier.is_active ?? supplier.isActive ?? true,
    updated_at: supplier.updated_at ?? supplier.updatedAt ?? supplier.created_at ?? null,
    created_at: supplier.created_at ?? supplier.createdAt ?? null,
    is_deleted: supplier.is_deleted ?? false,
    sync_status: supplier.sync_status ?? supplier.syncStatus ?? 'synced',
  };
};

export const normalizeSupplierList = (raw) => {
  const list = Array.isArray(raw) ? raw : [];
  return list.map(normalizeApiSupplier).filter(Boolean);
};

export const buildSupplierPayload = (supplier) => {
  if (!supplier) return null;
  return {
    name: supplier.name ?? '',
    mobile: supplier.mobile ?? supplier.phone ?? '',
    email: supplier.email ?? '',
    gst_number: supplier.gst_number ?? '',
    credit_limit: supplier.credit_limit ?? 0,
    address: supplier.address ?? '',
    is_active: supplier.is_active ?? true,
  };
};

export const filterSuppliersByTerm = (suppliers, term) => {
  const needle = String(term || '').trim().toLowerCase();
  if (!needle) return suppliers;
  return (Array.isArray(suppliers) ? suppliers : []).filter((supplier) => {
    const name = String(supplier?.name || '').toLowerCase();
    const mobile = String(supplier?.mobile || supplier?.phone || '').toLowerCase();
    const gst = String(supplier?.gst_number || '').toLowerCase();
    return name.includes(needle) || mobile.includes(needle) || gst.includes(needle);
  });
};
