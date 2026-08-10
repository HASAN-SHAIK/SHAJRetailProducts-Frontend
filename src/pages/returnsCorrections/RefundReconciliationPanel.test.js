import fs from 'fs';
import path from 'path';

describe('Sales Return refund reconciliation diagnostics', () => {
  const panelSource = fs.readFileSync(path.join(__dirname, 'RefundReconciliationPanel.jsx'), 'utf8');
  const historySource = fs.readFileSync(path.join(__dirname, 'ReturnHistoryPanel.jsx'), 'utf8');

  test('loads the reconciliation client and applies the presentation policy', () => {
    expect(panelSource).toContain('getLocalOrderRefundReconciliation(orderId)');
    expect(panelSource).toContain('summarizeRefundReconciliation(snapshot || {})');
    expect(panelSource).toContain('data-testid="local-pos-refund-reconciliation"');
  });

  test('surfaces explicit blocked, pending, and clear Central sync states', () => {
    expect(panelSource).toContain('data-testid="refund-sync-operator-state"');
    expect(panelSource).toContain("summary.syncState === 'blocked'");
    expect(panelSource).toContain("summary.syncState === 'pending'");
    expect(panelSource).toContain('Blocked — manager-authorized recovery required.');
    expect(panelSource).toContain('Pending — durable local refund facts are waiting for Central.');
    expect(panelSource).toContain('Clear — no local refund sync facts are pending.');
  });

  test('surfaces impossible money, inventory, or dead-letter sync facts without generic retry controls', () => {
    expect(panelSource).toContain('summary.hasPaymentMismatch || summary.hasInventoryMismatch');
    expect(panelSource).toContain('summary.hasDeadLetterSyncFacts');
    expect(panelSource).toContain('Recovery requires Central manager authorization for the exact poisoned event');
    expect(panelSource).toContain('Do not retry the refund until the sale is reconciled.');
    expect(panelSource).not.toContain('repairRefund');
    expect(panelSource).not.toContain('reconcileRefund(');
    expect(panelSource).not.toContain('retryDeadLetter');
    expect(panelSource).not.toContain('skipDeadLetter');
  });

  test('shows unpublished and dead-letter sync counts from the POS snapshot', () => {
    expect(panelSource).toContain('Unpublished sync facts:');
    expect(panelSource).toContain('summary.unpublishedSyncFacts');
    expect(panelSource).toContain('Dead-letter sync facts:');
    expect(panelSource).toContain('summary.deadLetterSyncFacts');
  });

  test('offers recovery only for the exact dead-letter head with a mandatory reason', () => {
    expect(panelSource).toContain("snapshot?.dead_letter_sync_head || null");
    expect(panelSource).toContain("deadLetterHead?.event_id");
    expect(panelSource).toContain('data-testid="central-authorized-refund-sync-recovery"');
    expect(panelSource).toContain('recoveryReason.trim()');
    expect(panelSource).toContain('disabled={!canRequestRecovery}');
    expect(panelSource).toContain('Request manager-authorized recovery');
  });

  test('routes recovery through the Central-authorized client and refreshes reconciliation after success or consumed grant', () => {
    expect(panelSource).toContain('recoverLocalRefundSync({');
    expect(panelSource).toContain('eventId: deadLetterEventId');
    expect(panelSource).toContain('reason: recoveryReason.trim()');
    expect(panelSource).toContain('sync_recovery_grant_consumed');
    expect(panelSource).toContain('setRecoveryRefreshKey((value) => value + 1)');
    expect(panelSource).toContain('Central verifies the signed-in user has canonical POS approval authority');
  });

  test('shares selected bill and refresh key with the existing local return-history surface', () => {
    expect(historySource).toContain("import RefundReconciliationPanel from './RefundReconciliationPanel';");
    expect(historySource).toContain('<RefundReconciliationPanel');
    expect(historySource).toContain('orderId={orderId}');
    expect(historySource).toContain('enabled={enabled}');
    expect(historySource).toContain('refreshKey={refreshKey}');
  });
});
