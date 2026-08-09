import fs from 'fs';
import path from 'path';

describe('Sales Return refund reconciliation diagnostics', () => {
  const panelSource = fs.readFileSync(path.join(__dirname, 'RefundReconciliationPanel.jsx'), 'utf8');
  const historySource = fs.readFileSync(path.join(__dirname, 'ReturnHistoryPanel.jsx'), 'utf8');

  test('loads the read-only reconciliation client and applies the presentation policy', () => {
    expect(panelSource).toContain('getLocalOrderRefundReconciliation(orderId)');
    expect(panelSource).toContain('summarizeRefundReconciliation(snapshot || {})');
    expect(panelSource).toContain('data-testid="local-pos-refund-reconciliation"');
  });

  test('surfaces impossible money or inventory facts without corrective controls', () => {
    expect(panelSource).toContain('summary.hasPaymentMismatch || summary.hasInventoryMismatch');
    expect(panelSource).toContain('Do not retry the refund until the sale is reconciled.');
    expect(panelSource).toContain('this panel is read-only');
    expect(panelSource).not.toContain('repairRefund');
    expect(panelSource).not.toContain('reconcileRefund(');
  });

  test('shares selected bill and refresh key with the existing local return-history surface', () => {
    expect(historySource).toContain("import RefundReconciliationPanel from './RefundReconciliationPanel';");
    expect(historySource).toContain('<RefundReconciliationPanel');
    expect(historySource).toContain('orderId={orderId}');
    expect(historySource).toContain('enabled={enabled}');
    expect(historySource).toContain('refreshKey={refreshKey}');
  });
});
