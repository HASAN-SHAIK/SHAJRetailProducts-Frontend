import { buildCustomerPayload, buildCustomerUpdatePayload } from '../../Repositories/api/customerNormalizer';
import { toLocalCustomerPayload } from '../../Repositories/local/customerPayload';

const fs = require('fs');
const path = require('path');

const read = (relative) => fs.readFileSync(path.join(__dirname, relative), 'utf8');

const FINANCIAL_KEYS = ['credit_limit', 'current_balance'];

describe('POS customer updates are never financial writes', () => {
  const edited = {
    name: 'Asha',
    phone: '9876543210',
    credit_limit: 5000,
    current_balance: 1200,
    type: 'retail',
  };

  test('API update payload omits credit_limit and current_balance entirely', () => {
    const payload = buildCustomerUpdatePayload(edited);
    FINANCIAL_KEYS.forEach((key) => expect(payload).not.toHaveProperty(key));
    expect(payload.name).toBe('Asha');
    expect(payload.phone).toBe('9876543210');
  });

  test('API update payload omits financial keys even when the record has none', () => {
    const payload = buildCustomerUpdatePayload({ name: 'No Money Fields', phone: '9000000000' });
    FINANCIAL_KEYS.forEach((key) => expect(payload).not.toHaveProperty(key));
  });

  test('billing create path is unchanged (still builds the legacy payload)', () => {
    const payload = buildCustomerPayload({ name: 'Walk-in', phone: '9000000001' });
    expect(payload).toHaveProperty('credit_limit', 0);
    expect(payload).toHaveProperty('current_balance', null);
  });

  test('local POS payload still drops financial fields', () => {
    const payload = toLocalCustomerPayload(edited);
    FINANCIAL_KEYS.concat(['credit_limit_minor', 'outstanding_minor']).forEach((key) =>
      expect(payload).not.toHaveProperty(key)
    );
  });

  test('API client uses the update payload builder for PUT', () => {
    const client = read('../../Repositories/api/customerApiClient.js');
    expect(client).toContain('buildCustomerUpdatePayload(payload)');
  });

  test('customer form exposes no editable financial control', () => {
    const form = read('CustomerForm.jsx');
    expect(form).not.toContain("handleChange('credit_limit')");
    expect(form).not.toContain("handleChange('current_balance')");
    expect(form).not.toMatch(/<input[^>]*(credit_limit|current_balance)/);
    expect(form).toContain('buildCustomerSubmitPayload(form');
  });
});
