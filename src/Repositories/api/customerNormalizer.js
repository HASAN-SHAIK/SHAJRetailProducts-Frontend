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

export const normalizeApiCustomer = (customer) => {
  if (!customer) return null;
  const id = customer.id ?? customer.customer_id ?? null;
  const mobile = customer.mobile ?? customer.phone ?? null;
  if (!id && !mobile) return null;
  const resolvedAddress =
    customer.address ??
    [customer.address_line1 ?? customer.addressLine1, customer.address_line2 ?? customer.addressLine2]
      .filter(Boolean)
      .join(', ') ??
    null;
  const resolvedLocation = customer.location ?? customer.customer_location ?? customer.city ?? null;

  return {
    id: id ?? null,
    name: customer.name ?? customer.customer_name ?? '',
    mobile,
    phone: customer.phone ?? customer.mobile ?? null,
    type: customer.type ?? customer.customer_type ?? 'retail',
    email: customer.email ?? null,
    shop_name: customer.shop_name ?? customer.shopName ?? null,
    gst_number: customer.gst_number ?? customer.gstNumber ?? null,
    credit_limit: customer.credit_limit ?? customer.creditLimit ?? 0,
    current_balance: customer.current_balance ?? customer.currentBalance ?? 0,
    notes: customer.notes ?? null,
    address: resolvedAddress ?? customer.customer_address ?? null,
    location: resolvedLocation,
    updated_at: customer.updated_at ?? customer.updatedAt ?? customer.created_at ?? null,
    created_at: customer.created_at ?? customer.createdAt ?? null,
    is_active: customer.is_active ?? customer.isActive ?? true,
  };
};

export const normalizeCustomerList = (raw) => {
  const list = Array.isArray(raw) ? raw : [];
  return list.map(normalizeApiCustomer).filter(Boolean);
};

export const buildCustomerPayload = (customer) => {
  if (!customer) return null;
  return {
    name: customer.name ?? customer.customer_name ?? '',
    phone: customer.phone ?? customer.mobile ?? '',
    mobile: customer.mobile ?? customer.phone ?? '',
    email: customer.email ?? null,
    type: customer.type ?? 'retail',
    shop_name: customer.shop_name ?? null,
    gst_number: customer.gst_number ?? null,
    credit_limit: customer.credit_limit ?? 0,
    current_balance: customer.current_balance ?? null,
    notes: customer.notes ?? null,
    address: customer.address ?? null,
    location: customer.location ?? null,
    is_active: customer.is_active ?? true,
  };
};

export const filterCustomersByTerm = (customers, term) => {
  const needle = String(term || '').trim().toLowerCase();
  if (!needle) return customers;
  return (Array.isArray(customers) ? customers : []).filter((customer) => {
    const name = String(customer?.name || '').toLowerCase();
    const phone = String(customer?.phone || customer?.mobile || '').toLowerCase();
    const shop = String(customer?.shop_name || '').toLowerCase();
    return name.includes(needle) || phone.includes(needle) || shop.includes(needle);
  });
};
