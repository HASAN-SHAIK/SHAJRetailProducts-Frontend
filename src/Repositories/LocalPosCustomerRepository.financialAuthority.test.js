import { toLocalCustomerPayload } from './LocalPosCustomerRepository';

describe('V1 customer financial authority', () => {
  test('POS customer writes carry identity/contact facts but never Central financial snapshots', () => {
    const payload = toLocalCustomerPayload({
      customer_code: 'CUS-100',
      name: 'Offline Customer',
      phone: '9000000000',
      email: 'customer@example.com',
      gst_number: '36ABCDE1234F1Z5',
      credit_limit: 25000,
      credit_limit_minor: 2500000,
      current_balance: 1234,
      outstanding_minor: 123400,
      currency: 'inr',
    });

    expect(payload).toEqual({
      customer_code: 'CUS-100',
      name: 'Offline Customer',
      phone: '9000000000',
      email: 'customer@example.com',
      tax_id: '36ABCDE1234F1Z5',
      currency: 'INR',
    });
    expect(payload).not.toHaveProperty('credit_limit');
    expect(payload).not.toHaveProperty('credit_limit_minor');
    expect(payload).not.toHaveProperty('current_balance');
    expect(payload).not.toHaveProperty('outstanding_minor');
  });
});