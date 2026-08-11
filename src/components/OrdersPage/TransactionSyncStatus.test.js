import fs from 'fs';
import path from 'path';

describe('V1 cashier transaction sync status surface', () => {
  const source = fs.readFileSync(path.join(__dirname, 'TransactionSyncStatus.jsx'), 'utf8');

  test('reads exact POS durable facts and exposes local, blocked, and Central-synced wording', () => {
    expect(source).toContain('getLocalTransactionSyncStatus(orderId)');
    expect(source).toContain('data-testid="transaction-sync-status"');
    expect(source).toContain('data-sync-state={summary.syncState}');
    expect(source).toContain('Local pending facts:');
    expect(source).toContain('Dead-letter facts:');
  });

  test('keeps transaction status presentation read-only and recovery Central-authorized', () => {
    expect(source).toContain('this status is read-only');
    expect(source).toContain('Central-authorized reconciliation flow');
    expect(source).not.toContain('retryDeadLetter');
    expect(source).not.toContain('skipDeadLetter');
    expect(source).not.toContain('forcePublish');
    expect(source).not.toContain('recoverLocalRefundSync');
    expect(source).not.toContain("method: 'POST'");
  });
});
