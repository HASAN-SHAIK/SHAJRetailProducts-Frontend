jest.mock('../../utils/axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

const fs = require('fs');
const path = require('path');
const api = require('../../utils/axios');
const { sendCustomerReminder } = require('../../services/customerReminderApi');

describe('V1 Automated SMS & Messaging Payment Reminders for Khata Debtors (FEAT-COMM-003)', () => {
  const modalSource = fs.readFileSync(path.join(__dirname, '../../components/customers/PaymentReminderModal.jsx'), 'utf8');
  const outstandingSource = fs.readFileSync(path.join(__dirname, 'Outstanding.jsx'), 'utf8');
  const customerDetailSource = fs.readFileSync(path.join(__dirname, '../customers/CustomerDetail.jsx'), 'utf8');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('sendCustomerReminder service dispatches POST /customers/:id/send-reminder', async () => {
    const payload = {
      phone: '9876543210',
      channel: 'sms',
      storeName: 'SHAJ Retail',
      upiId: 'shajretail@icici',
      amount: 2500,
    };

    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          reminder: {
            id: 99,
            customerId: 42,
            recipientPhone: '9876543210',
            amount: 2500,
            status: 'SENT',
          },
        },
      },
    });

    const res = await sendCustomerReminder(42, payload);

    expect(api.post).toHaveBeenCalledWith('/customers/42/send-reminder', payload);
    expect(res.reminder.id).toBe(99);
    expect(res.reminder.status).toBe('SENT');
  });

  test('PaymentReminderModal renders debtor details, channel buttons, and dynamic UPI link', () => {
    expect(modalSource).toContain('Send Khata Payment Reminder');
    expect(modalSource).toContain('Delivery Channel');
    expect(modalSource).toContain('Direct SMS');
    expect(modalSource).toContain('WhatsApp');
    expect(modalSource).toContain('Generated UPI Deep Link');
    expect(modalSource).toContain('upi://pay');
    expect(modalSource).toContain('Message Content');
    expect(modalSource).toContain('Send SMS Reminder');
  });

  test('Outstanding wires PaymentReminderModal and exposes Reminder button on debtor rows', () => {
    expect(outstandingSource).toContain("import PaymentReminderModal from '../../components/customers/PaymentReminderModal';");
    expect(outstandingSource).toContain('setReminderCustomer(row)');
    expect(outstandingSource).toContain('📱 Reminder');
    expect(outstandingSource).toContain('<PaymentReminderModal');
  });

  test('CustomerDetail wires PaymentReminderModal and exposes Send Reminder button for debit balance', () => {
    expect(customerDetailSource).toContain("import PaymentReminderModal from '../../components/customers/PaymentReminderModal';");
    expect(customerDetailSource).toContain('customer.current_balance > 0');
    expect(customerDetailSource).toContain('📱 Send Reminder');
    expect(customerDetailSource).toContain('<PaymentReminderModal');
  });
});
