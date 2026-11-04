import {
  buildCustomerUpdatePayload,
  getDuplicateCustomerFromError,
  isDuplicateCustomerError,
} from './customerNormalizer';
import { buildCustomerSubmitPayload } from '../../pages/customers/customerHelpers';

describe('presence-based customer update payload', () => {
  test('omits keys that were not supplied so stored values are preserved', () => {
    const payload = buildCustomerUpdatePayload({ name: 'Asha', phone: '9000000001' });
    expect(payload).toEqual({ name: 'Asha', phone: '9000000001', mobile: '9000000001' });
    ['email', 'notes', 'gst_number', 'shop_name', 'address', 'location', 'type', 'is_active'].forEach((key) =>
      expect(payload).not.toHaveProperty(key)
    );
  });

  test('null means unchanged, explicit empty string is sent so the server can clear it', () => {
    const payload = buildCustomerUpdatePayload({ name: 'A', phone: '9000000001', email: '', notes: '', gst_number: null });
    expect(payload.email).toBe('');
    expect(payload.notes).toBe('');
    expect(payload).not.toHaveProperty('gst_number');
  });

  test('never carries financial keys, even when present on the record', () => {
    const payload = buildCustomerUpdatePayload({
      name: 'A',
      phone: '9000000001',
      credit_limit: 500,
      current_balance: 90,
      creditLimit: 1,
      currentBalance: 2,
    });
    ['credit_limit', 'current_balance', 'creditLimit', 'currentBalance'].forEach((key) =>
      expect(payload).not.toHaveProperty(key)
    );
  });
});

describe('edit form submit payload can clear optional fields', () => {
  const form = { name: 'A', phone: '90000 00001', email: '', notes: '  ', shop_name: '', gst_number: '', address: '', location: '' };

  test('edit sends empty strings (clear)', () => {
    const payload = buildCustomerSubmitPayload(form, { isEdit: true });
    expect(payload.email).toBe('');
    expect(payload.notes).toBe('');
    expect(payload.gst_number).toBe('');
    expect(payload.phone).toBe('9000000001');
  });

  test('create keeps null for empty optionals', () => {
    const payload = buildCustomerSubmitPayload(form);
    expect(payload.email).toBeNull();
    expect(payload.notes).toBeNull();
  });

  test('edit payload run through the update builder keeps the clearing values', () => {
    const payload = buildCustomerUpdatePayload(buildCustomerSubmitPayload(form, { isEdit: true }));
    expect(payload.email).toBe('');
    expect(payload.notes).toBe('');
  });
});

describe('duplicate customer error parsing', () => {
  const existing = { id: 5, name: 'Existing', mobile: '9876543210', credit_limit: 2500, current_balance: 300 };

  test('reads the v1 error envelope', () => {
    const error = { response: { status: 409, data: { success: false, error: { code: 'DUPLICATE_CUSTOMER', details: { existing_customer: existing } } } } };
    expect(isDuplicateCustomerError(error)).toBe(true);
    expect(getDuplicateCustomerFromError(error)).toMatchObject({ id: 5, name: 'Existing' });
  });

  test('reads the legacy error envelope', () => {
    const error = { response: { status: 409, data: { success: false, code: 'DUPLICATE_CUSTOMER', details: { existing_customer: existing } } } };
    expect(getDuplicateCustomerFromError(error)).toMatchObject({ id: 5 });
  });

  test('other errors are not duplicates', () => {
    expect(isDuplicateCustomerError({ response: { status: 500 } })).toBe(false);
    expect(getDuplicateCustomerFromError({ response: { status: 500, data: {} } })).toBeNull();
    expect(getDuplicateCustomerFromError(new Error('x'))).toBeNull();
  });
});
