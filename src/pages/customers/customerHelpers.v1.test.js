import {
  buildCustomerSubmitPayload,
  customerToForm,
  findCustomerByPhone,
  formatInr,
  getAvailableCredit,
  isOverCreditLimit,
  validateCustomerForm,
} from './customerHelpers';

const validForm = {
  name: 'Asha Stores',
  phone: '98765 43210',
  email: 'asha@example.com',
  gst_number: '36abcde1234f1z5',
  type: 'wholesale',
};

describe('customer form validation', () => {
  test('accepts a valid form (GSTIN case-insensitive, phone with spaces)', () => {
    expect(validateCustomerForm(validForm)).toEqual({});
  });

  test('requires name and mobile', () => {
    const errors = validateCustomerForm({ name: '  ', phone: '' });
    expect(errors.name).toBeDefined();
    expect(errors.phone).toBeDefined();
  });

  test.each(['12345', '1234567890123456', 'abcdefghij'])('rejects mobile %s', (phone) => {
    expect(validateCustomerForm({ name: 'A', phone }).phone).toBeDefined();
  });

  test('rejects bad email, bad GSTIN and unknown type; optional fields may be empty', () => {
    const errors = validateCustomerForm({ ...validForm, email: 'nope', gst_number: 'XYZ', type: 'vip' });
    expect(errors.email).toBeDefined();
    expect(errors.gst_number).toBeDefined();
    expect(errors.type).toBeDefined();
    expect(validateCustomerForm({ name: 'A', phone: '9876543210' })).toEqual({});
  });
});

describe('customer submit payload', () => {
  test('normalizes identity fields and never includes financial keys', () => {
    const payload = buildCustomerSubmitPayload({
      ...validForm,
      credit_limit: 99999,
      current_balance: 500,
      outstanding_minor: 50000,
      loyalty_points: 10,
    });
    expect(payload).toMatchObject({
      name: 'Asha Stores',
      phone: '9876543210',
      mobile: '9876543210',
      gst_number: '36ABCDE1234F1Z5',
      type: 'wholesale',
      is_active: true,
    });
    ['credit_limit', 'current_balance', 'outstanding_minor', 'credit_limit_minor', 'loyalty_points'].forEach(
      (key) => expect(payload).not.toHaveProperty(key)
    );
  });

  test('customerToForm copies only editable fields', () => {
    const form = customerToForm({ name: 'X', mobile: '9876543210', credit_limit: 10, current_balance: 5 });
    expect(form.phone).toBe('9876543210');
    expect(form).not.toHaveProperty('credit_limit');
    expect(form).not.toHaveProperty('current_balance');
  });
});

describe('credit display helpers', () => {
  test('available credit and over-limit', () => {
    expect(getAvailableCredit({ credit_limit: 1000, current_balance: 250 })).toBe(750);
    expect(getAvailableCredit({ credit_limit: 0, current_balance: 250 })).toBeNull();
    expect(isOverCreditLimit({ credit_limit: 1000, current_balance: 1200 })).toBe(true);
    expect(isOverCreditLimit({ credit_limit: 0, current_balance: 1200 })).toBe(false);
    expect(isOverCreditLimit({ credit_limit: 1000, current_balance: 1000 })).toBe(false);
  });

  test('formatInr tolerates missing and string values', () => {
    expect(formatInr(undefined)).toBe('INR 0.00');
    expect(formatInr('12.5')).toBe('INR 12.50');
  });
});

describe('duplicate phone detection', () => {
  const list = [
    { id: 1, name: 'A', phone: '98765 43210' },
    { id: 2, name: 'B', mobile: '9000000000' },
  ];
  test('matches on digits only and can exclude the record being edited', () => {
    expect(findCustomerByPhone(list, '9876543210').id).toBe(1);
    expect(findCustomerByPhone(list, '9000000000').id).toBe(2);
    expect(findCustomerByPhone(list, '9000000000', 2)).toBeNull();
    expect(findCustomerByPhone(list, '')).toBeNull();
  });
});
