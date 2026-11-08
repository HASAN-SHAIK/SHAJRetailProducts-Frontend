jest.mock('../../utils/axios', () => ({
  post: jest.fn(),
  get: jest.fn(),
}));

const fs = require('fs');
const path = require('path');
const api = require('../../utils/axios');
const { createUnreferencedReturn } = require('../../services/returnsCorrectionsApi');

describe('V1 Unreferenced / Walk-In Item Returns (FEAT-RET-005)', () => {
  const salesReturnSource = fs.readFileSync(path.join(__dirname, 'SalesReturn.jsx'), 'utf8');
  const tabSource = fs.readFileSync(path.join(__dirname, 'UnreferencedReturnTab.jsx'), 'utf8');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('createUnreferencedReturn service dispatches POST /returns/unreferenced with payload', async () => {
    const payload = {
      customerName: 'Suresh Kumar',
      refundMode: 'cash',
      reason: 'Wrong size / lost bill',
      managerApprovedBy: 'Manager John',
      items: [
        {
          productId: 12,
          quantity: 2,
          unitPrice: 450,
          condition: 'good',
        },
      ],
    };

    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        return: {
          returnId: 'mock-unref-return-uuid',
          refundTotal: 900,
          isUnreferenced: true,
        },
      },
    });

    const res = await createUnreferencedReturn(payload);

    expect(api.post).toHaveBeenCalledWith('/returns/unreferenced', payload);
    expect(res.success).toBe(true);
    expect(res.return.returnId).toBe('mock-unref-return-uuid');
    expect(res.return.refundTotal).toBe(900);
  });

  test('UnreferencedReturnTab exposes manager override price, item condition grading, and payout modes', () => {
    // Manager override return price
    expect(tabSource).toContain('Override Return Price');
    expect(tabSource).toContain('Manager Authorized By');
    expect(tabSource).toContain('managerApprovedBy');

    // Item condition grading (good vs damaged)
    expect(tabSource).toContain('Good / Sellable (Restock)');
    expect(tabSource).toContain('Damaged / Defective (Write-off)');
    expect(tabSource).toContain('condition');

    // Refund mode selections
    expect(tabSource).toContain('Cash (Drawer Payout)');
    expect(tabSource).toContain('Store Credit / Khata');
    expect(tabSource).toContain('UPI / Bank Transfer');

    // Product search / scanner
    expect(tabSource).toContain('Scan Barcode or Search Products for Return');
    expect(tabSource).toContain('/products/search');

    // Action button
    expect(tabSource).toContain('Complete Walk-In Return');
  });

  test('SalesReturn renders tab navigation switching between Bill-Referenced and Unreferenced Walk-In modes', () => {
    expect(salesReturnSource).toContain("import UnreferencedReturnTab from './UnreferencedReturnTab';");
    expect(salesReturnSource).toContain("const [activeTab, setActiveTab] = useState('referenced');");
    expect(salesReturnSource).toContain('Bill-Referenced Return');
    expect(salesReturnSource).toContain('Walk-In / Unreferenced Return (FEAT-RET-005)');
    expect(salesReturnSource).toContain('<UnreferencedReturnTab');
  });
});
