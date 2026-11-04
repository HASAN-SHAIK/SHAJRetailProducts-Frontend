jest.mock('../../utils/axios', () => ({
  post: jest.fn(),
  get: jest.fn(),
}));

const fs = require('fs');
const path = require('path');
const { fetchCashBook } = require('../../services/accountingService');
const api = require('../../utils/axios');

const source = fs.readFileSync(path.join(__dirname, 'CashBook.jsx'), 'utf8');

describe('V1 POS CashBook component and branch custody authority', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('guards route access with canAccessCashBook and redirects unauthorized users (staff)', () => {
    expect(source).toContain('canAccessCashBook');
    expect(source).toContain('if (!isAuthorized)');
    expect(source).toContain('<Navigate to="/billing/retail" replace />');
  });

  test('presents branch-scoped cash custody header and drawer indicators', () => {
    expect(source).toContain('getBranchDisplayName');
    expect(source).toContain('branchName');
    expect(source).toContain('accounts-branch-tag');
  });

  test('renders opening balance, inflow, outflow, and current cash in hand summary cards', () => {
    expect(source).toContain('Opening Cash Float');
    expect(source).toContain('Total Inflow (Receipts)');
    expect(source).toContain('Total Outflow (Payments)');
    expect(source).toContain('Current Cash in Hand');
    expect(source).toContain('closingBalance');
  });

  test('supports date range presets including today, yesterday, this_week, this_month, and custom', () => {
    expect(source).toContain("handleRangeChange('today')");
    expect(source).toContain("handleRangeChange('yesterday')");
    expect(source).toContain("handleRangeChange('this_week')");
    expect(source).toContain("handleRangeChange('this_month')");
    expect(source).toContain("handleRangeChange('custom')");
  });

  test('displays offline mode warning banner when network is unavailable', () => {
    expect(source).toContain('accounts-offline-alert');
    expect(source).toContain('Offline Mode:');
    expect(source).toContain("window.addEventListener('online'");
    expect(source).toContain("window.addEventListener('offline'");
  });

  test('fetchCashBook service queries /accounts/cashbook and returns structured entries and opening balance', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          opening_balance: 5000,
          entries: [
            {
              id: 'txn-1',
              date: '2026-11-04T10:00:00Z',
              description: 'Morning receipt',
              debit: 1500,
              credit: 0,
              running_balance: 6500,
            },
          ],
        },
      },
    });

    const res = await fetchCashBook({ range: 'today', branch_id: 'branch-101' });
    expect(api.get).toHaveBeenCalledWith(
      '/accounts/cashbook',
      expect.objectContaining({
        params: expect.objectContaining({
          range: 'today',
          branch_id: 'branch-101',
        }),
      })
    );
    expect(res.opening_balance).toBe(5000);
    expect(res.entries.length).toBe(1);
    expect(res.entries[0].running_balance).toBe(6500);
  });
});
