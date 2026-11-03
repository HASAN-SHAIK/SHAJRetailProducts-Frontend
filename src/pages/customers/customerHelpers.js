// Pure helpers for the POS customer screens (list / detail / form).
//
// Financial authority rule (V1): credit limit and outstanding balance are owned
// by Central accounting. POS may DISPLAY them but must never send them back.
// `buildCustomerSubmitPayload` is the single place that decides what a POS
// customer form is allowed to submit, and it never includes financial fields.

export const CUSTOMER_TYPES = ['retail', 'wholesale'];

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatInr = (value) => `INR ${toNumber(value).toFixed(2)}`;

export const normalizePhoneDigits = (value) => String(value ?? '').replace(/\D+/g, '');

/** Credit still available. Returns null when the customer has no credit limit. */
export const getAvailableCredit = (customer) => {
  const limit = toNumber(customer?.credit_limit);
  if (limit <= 0) return null;
  return limit - toNumber(customer?.current_balance);
};

/** True when a credit limit exists and the outstanding balance exceeds it. */
export const isOverCreditLimit = (customer) => {
  const limit = toNumber(customer?.credit_limit);
  return limit > 0 && toNumber(customer?.current_balance) > limit;
};

export const EMPTY_CUSTOMER_FORM = Object.freeze({
  name: '',
  phone: '',
  email: '',
  shop_name: '',
  type: 'retail',
  gst_number: '',
  address: '',
  location: '',
  notes: '',
  is_active: true,
});

/** Copy only the editable identity/contact fields out of a customer record. */
export const customerToForm = (customer) => {
  if (!customer) return { ...EMPTY_CUSTOMER_FORM };
  return {
    name: customer.name || '',
    phone: customer.phone || customer.mobile || '',
    email: customer.email || '',
    shop_name: customer.shop_name || '',
    type: CUSTOMER_TYPES.includes(String(customer.type || '').toLowerCase())
      ? String(customer.type).toLowerCase()
      : 'retail',
    gst_number: customer.gst_number || '',
    address: customer.address || '',
    location: customer.location || '',
    notes: customer.notes || '',
    is_active: customer.is_active !== false,
  };
};

/** Returns `{ field: message }`; an empty object means the form is valid. */
export const validateCustomerForm = (form = {}) => {
  const errors = {};
  const name = String(form.name || '').trim();
  const phoneDigits = normalizePhoneDigits(form.phone);
  const email = String(form.email || '').trim();
  const gst = String(form.gst_number || '').trim().toUpperCase();

  if (!name) errors.name = 'Customer name is required.';
  else if (name.length > 120) errors.name = 'Name must be 120 characters or fewer.';

  if (!phoneDigits) errors.phone = 'Mobile number is required.';
  else if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    errors.phone = 'Enter a valid mobile number (10 to 15 digits).';
  }

  if (email && !EMAIL_PATTERN.test(email)) errors.email = 'Enter a valid email address.';
  if (gst && !GSTIN_PATTERN.test(gst)) errors.gst_number = 'Enter a valid 15-character GSTIN.';
  if (form.type && !CUSTOMER_TYPES.includes(String(form.type).toLowerCase())) {
    errors.type = 'Select a valid customer type.';
  }
  return errors;
};

/**
 * Whitelisted submit payload. Deliberately has NO credit_limit, current_balance,
 * outstanding or loyalty keys, whatever the form state contains.
 */
// On edit, an emptied optional field is sent as '' so the server clears it
// (null would mean "leave unchanged"). On create there is nothing to clear.
export const buildCustomerSubmitPayload = (form = {}, { isEdit = false } = {}) => {
  const optional = (value, transform = (text) => text) => {
    const text = transform(String(value || '').trim());
    return text || (isEdit ? '' : null);
  };
  return {
  name: String(form.name || '').trim(),
  phone: normalizePhoneDigits(form.phone),
  mobile: normalizePhoneDigits(form.phone),
  email: optional(form.email),
  shop_name: optional(form.shop_name),
  type: CUSTOMER_TYPES.includes(String(form.type || '').toLowerCase())
    ? String(form.type).toLowerCase()
    : 'retail',
  gst_number: optional(form.gst_number, (text) => text.toUpperCase()),
  address: optional(form.address),
  location: optional(form.location),
  notes: optional(form.notes),
  is_active: form.is_active !== false,
  };
};

/** Finds an existing customer with the same phone number (excluding `excludeId`). */
export const findCustomerByPhone = (customers, phone, excludeId = null) => {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return null;
  return (
    (Array.isArray(customers) ? customers : []).find((customer) => {
      if (excludeId !== null && excludeId !== undefined && String(customer?.id) === String(excludeId)) {
        return false;
      }
      return normalizePhoneDigits(customer?.phone || customer?.mobile) === digits;
    }) || null
  );
};

export const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
};
