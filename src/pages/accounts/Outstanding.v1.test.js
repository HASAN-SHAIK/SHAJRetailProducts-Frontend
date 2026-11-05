jest.mock('../../utils/axios', () => ({
  post: jest.fn(),
  get: jest.fn(),
}));

const fs = require('fs');
const path = require('path');
const { fetchOutstanding } = require('../../services/accountingService');
const api = require('../../utils/axios');

const source = fs.readFileSync(path.join(__dirname, 'Outstanding.jsx'), 'utf8');

describe('V1 POS Outstanding component and receivables authority', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('guards route access with canAccessOutstanding and redirects unauthorized users (staff)', () => {
    expect(source).toContain('canAccessOutstanding');
    expect(source).toContain('if (!isAuthorized)');
    expect(source).toContain('<Navigate to="/billing/retail" replace />');
  });

  test('conditionally renders Supplier Payables tab based on canAccessSupplierOutstanding', () => {
    expect(source).toContain('canAccessSupplierOutstanding');
    expect(source).toContain('{canViewSuppliers && (');
    expect(source).toContain('Supplier Payables');
    expect(source).toContain('Customer Receivables');
  });

  test('renders summary cards for total balance, account count, and highest balance', () => {
    expect(source).toContain('Accounts with Balance');
    expect(source).toContain('Highest Outstanding Balance');
    expect(source).toContain('totalOutstanding');
  });

  test('provides search input and real-time filtering by account name or ID', () => {
    expect(source).toContain('Search customer by name or ID...');
    expect(source).toContain('filteredRows');
    expect(source).toContain('Clear Search');
  });

  test('deep-links to Receipt Entry with customer parameters on Collect Payment', () => {
    expect(source).toContain('handleCollectReceipt');
    expect(source).toContain('/accounts/receipt?customerId=');
    expect(source).toContain('Collect Payment');
  });

  test('deep-links to Payment Entry with supplier parameters on Pay Supplier', () => {
    expect(source).toContain('handlePaySupplier');
    expect(source).toContain('/accounts/payment?supplierId=');
    expect(source).toContain('Pay Supplier');
  });

  test('displays offline mode warning banner when network is disconnected', () => {
    expect(source).toContain('accounts-offline-alert');
    expect(source).toContain('Offline Mode:');
    expect(source).toContain("window.addEventListener('online'");
    expect(source).toContain("window.addEventListener('offline'");
  });

  test('fetchOutstanding service queries /accounts/outstanding with resolved type and branch', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          rows: [
            {
              id: '12',
              name: 'Sample Customer',
              total_debit: 20000,
              total_credit: 15000,
              outstanding: 5000,
            },
          ],
        },
      },
    });

    const res = await fetchOutstanding({ type: 'customer', branch_id: 'branch-202' });
    expect(api.get).toHaveBeenCalledWith(
      '/accounts/outstanding',
      expect.objectContaining({
        params: expect.objectContaining({
          type: 'customer',
          branch_id: 'branch-202',
        }),
      })
    );
    expect(res.rows.length).toBe(1);
    expect(res.rows[0].outstanding).toBe(5000);
  });
});
