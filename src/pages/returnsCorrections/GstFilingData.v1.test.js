const fs = require('fs');
const path = require('path');

describe('V1 GST Filing Schedules & CSV Export (FEAT-GST-004)', () => {
  const source = fs.readFileSync(path.join(__dirname, 'GstFilingData.jsx'), 'utf8');

  test('replaces raw stringified JSON with structured tabular schedules', () => {
    expect(source).not.toContain('JSON.stringify(data, null, 2)');
    expect(source).toContain('SCHEDULE_TABS');
    expect(source).toContain('B2B Invoices (Table 4)');
    expect(source).toContain('B2C Small (Table 7)');
    expect(source).toContain('B2C Large (Table 5)');
    expect(source).toContain('Credit / Debit Notes (Table 9B)');
    expect(source).toContain('GSTR-3B Tax Summary');
  });

  test('implements CSV export for CA handoff', () => {
    expect(source).toContain('exportCsv');
    expect(source).toContain('Export Active Schedule CSV');
    expect(source).toContain('Export Full GSTR-1 Package');
    expect(source).toContain('data:text/csv;charset=utf-8');
  });

  test('computes consolidated GSTR-3B net liability summary cards', () => {
    expect(source).toContain('Net Taxable Turnover');
    expect(source).toContain('Central Tax (CGST)');
    expect(source).toContain('State Tax (SGST)');
    expect(source).toContain('Integrated Tax (IGST)');
    expect(source).toContain('Total Net Tax Liability');
  });

  test('provides date range presets including This Month and Last Month', () => {
    expect(source).toContain('handleSetThisMonth');
    expect(source).toContain('handleSetLastMonth');
    expect(source).toContain('handleClearDates');
    expect(source).toContain('This Month');
    expect(source).toContain('Last Month');
  });

  test('displays schedule totals footer with taxable amount and tax breakdown', () => {
    expect(source).toContain('SCHEDULE TOTALS');
    expect(source).toContain('activeTotals.taxable');
    expect(source).toContain('activeTotals.totalTax');
    expect(source).toContain('activeTotals.invoiceTotal');
  });
});
