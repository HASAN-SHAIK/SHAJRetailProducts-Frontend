const toCount = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

export const summarizeTransactionSyncStatus = (snapshot = {}) => {
  const unpublishedFacts = toCount(snapshot.unpublished_sync_facts);
  const deadLetterFacts = toCount(snapshot.dead_letter_sync_facts);

  const syncState = deadLetterFacts > 0
    ? 'blocked'
    : unpublishedFacts > 0
      ? 'pending'
      : 'synced';

  return {
    orderId: String(snapshot.order_id || '').trim(),
    orderStatus: String(snapshot.order_status || '').trim(),
    unpublishedFacts,
    deadLetterFacts,
    syncState,
  };
};

export const transactionSyncStatusMessage = (syncState) => {
  if (syncState === 'blocked') {
    return 'Central sync blocked — manager-authorized recovery is required.';
  }
  if (syncState === 'pending') {
    return 'Completed locally — durable transaction facts are waiting for Central.';
  }
  return 'Synced with Central — no local durable transaction facts are pending.';
};
