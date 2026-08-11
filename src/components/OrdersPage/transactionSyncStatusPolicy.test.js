import {
  summarizeTransactionSyncStatus,
  transactionSyncStatusMessage,
} from './transactionSyncStatusPolicy';

describe('V1 transaction sync status presentation policy', () => {
  test('derives blocked, pending, and synced only from durable POS facts', () => {
    expect(summarizeTransactionSyncStatus({
      unpublished_sync_facts: 3,
      dead_letter_sync_facts: 1,
    }).syncState).toBe('blocked');

    expect(summarizeTransactionSyncStatus({
      unpublished_sync_facts: 2,
      dead_letter_sync_facts: 0,
    }).syncState).toBe('pending');

    expect(summarizeTransactionSyncStatus({
      unpublished_sync_facts: 0,
      dead_letter_sync_facts: 0,
    }).syncState).toBe('synced');
  });

  test('uses operator wording that distinguishes local completion from Central convergence', () => {
    expect(transactionSyncStatusMessage('pending')).toContain('Completed locally');
    expect(transactionSyncStatusMessage('pending')).toContain('waiting for Central');
    expect(transactionSyncStatusMessage('synced')).toContain('Synced with Central');
    expect(transactionSyncStatusMessage('blocked')).toContain('manager-authorized recovery');
  });

  test('normalizes invalid counts without inventing pending work', () => {
    expect(summarizeTransactionSyncStatus({
      order_id: ' order-1 ',
      order_status: ' completed ',
      unpublished_sync_facts: -1,
      dead_letter_sync_facts: 'bad',
    })).toEqual({
      orderId: 'order-1',
      orderStatus: 'completed',
      unpublishedFacts: 0,
      deadLetterFacts: 0,
      syncState: 'synced',
    });
  });
});
