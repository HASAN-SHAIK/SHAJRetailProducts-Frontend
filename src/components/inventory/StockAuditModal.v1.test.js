jest.mock('../../utils/axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

const fs = require('fs');
const path = require('path');
const api = require('../../utils/axios');
const {
  lookupProductForAudit,
  submitStockAudit,
} = require('../../services/stockAuditApi');

describe('V1 Quick Physical Stocktaking Barcode Audit Modal (FEAT-INV-005)', () => {
  const modalSource = fs.readFileSync(path.join(__dirname, 'StockAuditModal.jsx'), 'utf8');
  const productsPageSource = fs.readFileSync(path.join(__dirname, '../ProductsPage/ProductsPage.jsx'), 'utf8');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('lookupProductForAudit dispatches GET /stock/audit/lookup with barcode query', async () => {
    api.get.mockResolvedValueOnce({
      data: {
        success: true,
        product: {
          productId: 101,
          name: 'Toor Dal 1kg',
          barcode: '890123450001',
          bookStock: 30,
        },
      },
    });

    const res = await lookupProductForAudit('890123450001');

    expect(api.get).toHaveBeenCalledWith('/stock/audit/lookup', {
      params: { query: '890123450001' },
    });
    expect(res.productId).toBe(101);
    expect(res.name).toBe('Toor Dal 1kg');
    expect(res.bookStock).toBe(30);
  });

  test('submitStockAudit dispatches POST /stock/audit/submit-scan with physical audit payload', async () => {
    const payload = {
      notes: 'Rack 1 Audit',
      scans: [
        { productId: 101, physicalCount: 32 },
      ],
    };

    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        summary: {
          totalScanned: 1,
          matched: 0,
          discrepancies: 1,
          netVariance: 2,
        },
      },
    });

    const res = await submitStockAudit(payload);

    expect(api.post).toHaveBeenCalledWith('/stock/audit/submit-scan', payload);
    expect(res.success).toBe(true);
    expect(res.summary.discrepancies).toBe(1);
    expect(res.summary.netVariance).toBe(2);
  });

  test('StockAuditModal component provides rapid barcode scanning, variance computation, and CSV export', () => {
    expect(modalSource).toContain('Quick Physical Stocktaking Barcode Audit');
    expect(modalSource).toContain('barcode-scanner-input');
    expect(modalSource).toContain('Scan barcode or type barcode / SKU here...');
    expect(modalSource).toContain('Book Stock');
    expect(modalSource).toContain('Physical Count');
    expect(modalSource).toContain('Variance');
    expect(modalSource).toContain('Export Variance CSV');
    expect(modalSource).toContain('Commit Audit');
  });

  test('ProductsPage integrates StockAuditModal and exposes toolbar trigger button', () => {
    expect(productsPageSource).toContain("import StockAuditModal from '../inventory/StockAuditModal';");
    expect(productsPageSource).toContain('Stocktake Barcode Audit');
    expect(productsPageSource).toContain('stockAuditModalOpen');
    expect(productsPageSource).toContain('<StockAuditModal');
  });
});
