import fs from 'fs';
import path from 'path';

describe('V1 cashier-visible refund recovery lifecycle acceptance', () => {
  const panelSource = fs.readFileSync(path.join(__dirname, 'RefundReconciliationPanel.jsx'), 'utf8');

  test('keeps dead-letter recovery fail-closed and Central-authorized', () => {
    expect(panelSource).toContain("summary.syncState === 'blocked'");
    expect(panelSource).toContain('Blocked — manager-authorized recovery required.');
    expect(panelSource).toContain('snapshot?.dead_letter_sync_head || null');
    expect(panelSource).toContain('recoveryReason.trim()');
    expect(panelSource).toContain('recoverLocalRefundSync({');
    expect(panelSource).toContain('eventId: deadLetterEventId');
    expect(panelSource).toContain('Central verifies the signed-in user has canonical POS approval authority');
  });

  test('refreshes durable reconciliation after accepted or consumed recovery authorization', () => {
    expect(panelSource).toContain('Central authorized recovery was accepted. Refreshing reconciliation facts.');
    expect(panelSource).toContain('sync_recovery_grant_consumed');
    expect(panelSource).toContain('setRecoveryRefreshKey((value) => value + 1)');
    expect(panelSource).toContain('[enabled, orderId, refreshKey, recoveryRefreshKey]');
  });

  test('surfaces the post-recovery convergence states without introducing local authority', () => {
    expect(panelSource).toContain("summary.syncState === 'pending'");
    expect(panelSource).toContain('Pending — durable local refund facts are waiting for Central.');
    expect(panelSource).toContain('Clear — no local refund sync facts are pending.');
    expect(panelSource).not.toContain('retryDeadLetter');
    expect(panelSource).not.toContain('skipDeadLetter');
    expect(panelSource).not.toContain('forcePublish');
    expect(panelSource).not.toContain('repairRefund');
  });
});
