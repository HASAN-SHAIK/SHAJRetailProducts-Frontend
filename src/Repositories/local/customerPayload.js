export const toLocalCustomerPayload = (payload = {}) => ({
  customer_code: payload.customer_code || payload.customerCode || undefined,
  name: payload.name || payload.customer_name || '',
  phone: payload.phone || payload.mobile || payload.customer_phone || undefined,
  email: payload.email || undefined,
  tax_id: payload.tax_id || payload.gstin || payload.gst_number || undefined,
  currency: String(payload.currency || 'INR').toUpperCase(),
});
