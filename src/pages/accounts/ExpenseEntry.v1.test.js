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

const { generateClientTxnId, createExpense, createPayment } = require('../../services/accountingService');
const api = require('../../utils/axios');

const source = fs.readFileSync(path.join(__dirname, 'ExpenseEntry.jsx'), 'utf8');

describe('V1 POS ExpenseEntry component and service authority', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('guards route access with canAccessExpenseEntry and redirects unauthorized users (cashier and staff)', () => {
    expect(source).toContain('canAccessExpenseEntry');
    expect(source).toContain('if (!isAuthorized)');
    expect(source).toContain('<Navigate to="/billing/retail" replace />');
  });

  test('enforces online-only execution and disables submission when offline', () => {
    expect(source).toContain('Offline Mode');
    expect(source).toContain('disabled={!isOnline || submitting');
    expect(source).toContain('Accounting expenses cannot be submitted while offline');
    expect(source).toContain("window.addEventListener('online'");
    expect(source).toContain("window.addEventListener('offline'");
  });

  test('restricts payment modes strictly to cash and bank only (no online/upi)', () => {
    expect(source).toContain('<option value="cash">Cash (Cash Drawer)</option>');
    expect(source).toContain('<option value="bank">Bank</option>');
    expect(source).not.toContain('<option value="online">');
    expect(source).not.toContain('<option value="upi">');
    expect(source).toContain("!['cash', 'bank'].includes(paymentMode)");
  });

  test('maps standard categories aligning with backend ledgers', () => {
    expect(source).toContain('EXPENSE_CATEGORIES');
    expect(source).toContain('Utilities');
    expect(source).toContain('Rent');
    expect(source).toContain('Salaries');
    expect(source).toContain('Misc Expense');
    expect(source).toContain('debit specific ledgers; other operational expenses debit Misc Expense');
  });

  test('preserves UUID idempotency across retries and provides conflict feedback', () => {
    expect(source).toContain('clientTxnIdRef');
    expect(source).toContain('lastSubmittedPayloadRef');
    expect(source).toContain('IDEMPOTENCY_CONFLICT');
    expect(source).toContain('(Idempotent Replay)');
    expect(source).toContain('Recording Expense...');
  });

  test('provides direct shortcut to CashBook for drawer reconciliation', () => {
    expect(source).toContain("navigate('/accounts/cashbook')");
    expect(source).toContain('View Cash Book');
    expect(source).toContain('View in Cash Book');
  });

  test('createExpense service calls /accounts/payment with type: expense, strictly nulling supplier_id and order_id', async () => {
    api.post.mockResolvedValueOnce({ data: { success: true, data: { id: 301 } } });
    const clientTxnId = generateClientTxnId();

    const result = await createExpense({
      amount: 450,
      payment_mode: 'cash',
      expense_category: 'Utilities',
      notes: 'Shop electricity bill',
      client_txn_id: clientTxnId,
    });

    expect(api.post).toHaveBeenCalledWith(
      '/accounts/payment',
      expect.objectContaining({
        type: 'expense',
        supplier_id: null,
        order_id: null,
        amount: 450,
        payment_mode: 'cash',
        expense_category: 'Utilities',
        notes: 'Shop electricity bill',
        client_txn_id: clientTxnId,
      })
    );
    expect(result.id).toBe(301);
  });

  test('createExpense service works with bank payment mode', async () => {
    api.post.mockResolvedValueOnce({ data: { success: true, data: { id: 302 } } });
    const clientTxnId = generateClientTxnId();

    const result = await createExpense({
      amount: 15000,
      payment_mode: 'bank',
      expense_category: 'Rent',
      notes: 'Monthly store lease payment',
      client_txn_id: clientTxnId,
    });

    expect(api.post).toHaveBeenCalledWith(
      '/accounts/payment',
      expect.objectContaining({
        type: 'expense',
        supplier_id: null,
        order_id: null,
        amount: 15000,
        payment_mode: 'bank',
        expense_category: 'Rent',
      })
    );
    expect(result.id).toBe(302);
  });
});
