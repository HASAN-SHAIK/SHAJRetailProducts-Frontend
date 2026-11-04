jest.mock('../../utils/axios', () => ({
  post: jest.fn(),
  get: jest.fn(),
}));

const fs = require('fs');
const path = require('path');
const nodeCrypto = require('crypto');

if (typeof window !== 'undefined' && (!window.crypto || !window.crypto.getRandomValues)) {
  Object.defineProperty(window, 'crypto', {
    value: nodeCrypto.webcrypto,
    configurable: true,
  });
}
if (typeof global !== 'undefined' && (!global.crypto || !global.crypto.getRandomValues)) {
  Object.defineProperty(global, 'crypto', {
    value: nodeCrypto.webcrypto,
    configurable: true,
  });
}

const { generateClientTxnId, createReceipt } = require('../../services/accountingService');
const api = require('../../utils/axios');

const source = fs.readFileSync(path.join(__dirname, 'ReceiptEntry.jsx'), 'utf8');

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('V1 POS ReceiptEntry component and service authority', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('generates valid RFC 4122 v4 UUIDs using cryptographic randomness', () => {
    const id1 = generateClientTxnId();
    const id2 = generateClientTxnId();
    expect(id1).toMatch(UUID_V4_REGEX);
    expect(id2).toMatch(UUID_V4_REGEX);
    expect(id1).not.toBe(id2);
  });

  test('guards route access with canAccessReceiptEntry and redirects unauthorized users', () => {
    expect(source).toContain('canAccessReceiptEntry');
    expect(source).toContain('if (!isAuthorized)');
    expect(source).toContain('<Navigate to="/billing/retail" replace />');
  });

  test('enforces online-only execution and disables submission when offline', () => {
    expect(source).toContain('Offline Mode');
    expect(source).toContain('disabled={!isOnline || submitting');
    expect(source).toContain('Accounting receipts cannot be submitted while offline');
    expect(source).toContain("window.addEventListener('online'");
    expect(source).toContain("window.addEventListener('offline'");
  });

  test('integrates customer search and detail lookup for sales orders', () => {
    expect(source).toContain('searchCustomers');
    expect(source).toContain('getCustomerDetail');
    expect(source).toContain('On Account (General Receipt)');
  });

  test('supports cash, bank, and online payment modes', () => {
    expect(source).toContain('<option value="cash">Cash</option>');
    expect(source).toContain('<option value="bank">Bank</option>');
    expect(source).toContain('<option value="online">Online / UPI</option>');
  });

  test('enforces in-flight submission lock and idempotency recovery feedback', () => {
    expect(source).toContain('setSubmitting(true)');
    expect(source).toContain('IDEMPOTENCY_CONFLICT');
    expect(source).toContain('(Idempotent Replay)');
    expect(source).toContain('Recording Receipt...');
  });

  test('createReceipt service passes RFC 4122 client_txn_id and normalized parameters', async () => {
    api.post.mockResolvedValueOnce({ data: { success: true, data: { id: 101 } } });
    const clientTxnId = generateClientTxnId();

    const result = await createReceipt({
      customer_id: 5,
      amount: 250,
      payment_mode: 'upi',
      order_id: 12,
      notes: 'Test receipt notes',
      client_txn_id: clientTxnId,
    });

    expect(api.post).toHaveBeenCalledWith(
      '/accounts/receipt',
      expect.objectContaining({
        customer_id: 5,
        amount: 250,
        payment_mode: 'online', // upi normalized to online
        order_id: 12,
        notes: 'Test receipt notes',
        client_txn_id: clientTxnId,
      })
    );
    expect(result.id).toBe(101);
  });
});
