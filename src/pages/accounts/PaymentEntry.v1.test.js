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

const { generateClientTxnId, createPayment } = require('../../services/accountingService');
const api = require('../../utils/axios');

const source = fs.readFileSync(path.join(__dirname, 'PaymentEntry.jsx'), 'utf8');

describe('V1 POS PaymentEntry component and service authority', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('guards route access with canAccessPaymentEntry and redirects unauthorized users (cashier and staff)', () => {
    expect(source).toContain('canAccessPaymentEntry');
    expect(source).toContain('if (!isAuthorized)');
    expect(source).toContain('<Navigate to="/billing/retail" replace />');
  });

  test('enforces online-only execution and disables submission when offline', () => {
    expect(source).toContain('Offline Mode');
    expect(source).toContain('disabled={!isOnline || submitting');
    expect(source).toContain('Accounting payments cannot be submitted while offline');
    expect(source).toContain("window.addEventListener('online'");
    expect(source).toContain("window.addEventListener('offline'");
  });

  test('restricts payment modes strictly to cash and bank only (no online/upi)', () => {
    expect(source).toContain('<option value="cash">Cash</option>');
    expect(source).toContain('<option value="bank">Bank</option>');
    expect(source).not.toContain('<option value="online">');
    expect(source).not.toContain('<option value="upi">');
    expect(source).toContain("!['cash', 'bank'].includes(paymentMode)");
  });

  test('supports supplier payments, expense payouts, and owner drawings', () => {
    expect(source).toContain("handleTypeChange('supplier')");
    expect(source).toContain("handleTypeChange('expense')");
    expect(source).toContain("handleTypeChange('drawings')");
    expect(source).toContain('EXPENSE_CATEGORIES');
  });

  test('enforces in-flight submission lock and idempotency conflict feedback', () => {
    expect(source).toContain('setSubmitting(true)');
    expect(source).toContain('IDEMPOTENCY_CONFLICT');
    expect(source).toContain('(Idempotent Replay)');
    expect(source).toContain('Recording Payment...');
  });

  test('createPayment service passes RFC 4122 client_txn_id and strictly cash/bank payment modes', async () => {
    api.post.mockResolvedValueOnce({ data: { success: true, data: { id: 202 } } });
    const clientTxnId = generateClientTxnId();

    const result = await createPayment({
      type: 'supplier',
      supplier_id: 3,
      amount: 450,
      payment_mode: 'bank',
      order_id: 15,
      notes: 'Purchase invoice payment',
      client_txn_id: clientTxnId,
    });

    expect(api.post).toHaveBeenCalledWith(
      '/accounts/payment',
      expect.objectContaining({
        type: 'supplier',
        supplier_id: 3,
        amount: 450,
        payment_mode: 'bank',
        order_id: 15,
        notes: 'Purchase invoice payment',
        client_txn_id: clientTxnId,
      })
    );
    expect(result.id).toBe(202);
  });

  test('createPayment service disallows order_id and supplier_id for expense payouts', async () => {
    api.post.mockResolvedValueOnce({ data: { success: true, data: { id: 203 } } });

    await createPayment({
      type: 'expense',
      amount: 1500,
      payment_mode: 'cash',
      expense_category: 'Rent',
      notes: 'Shop rent for this month',
    });

    expect(api.post).toHaveBeenCalledWith(
      '/accounts/payment',
      expect.objectContaining({
        type: 'expense',
        supplier_id: null,
        order_id: null,
        amount: 1500,
        payment_mode: 'cash',
        expense_category: 'Rent',
      })
    );
  });
});
