import React, { useEffect, useMemo, useState } from 'react';
import { getLocalTransactionSyncStatus } from '../../services/local/transactionSyncStatusLocalService';
import { summarizeTransactionSyncStatus, transactionSyncStatusMessage } from './transactionSyncStatusPolicy';

const TransactionSyncStatus = ({ orderId, enabled }) => {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    if (!enabled || !orderId) {
      setSnapshot(null);
      setError('');
      setLoading(false);
      return () => { cancelled = true; };
    }

    setLoading(true);
    setError('');
    getLocalTransactionSyncStatus(orderId)
      .then((result) => {
        if (!cancelled) setSnapshot(result || null);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setSnapshot(null);
          setError(requestError?.message || 'transaction_sync_status_unavailable');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [enabled, orderId]);

  const summary = useMemo(
    () => summarizeTransactionSyncStatus(snapshot || {}),
    [snapshot]
  );

  if (!enabled || !orderId) return null;

  return (
    <section className="drawer-section" data-testid="transaction-sync-status">
      <h4>Central Sync</h4>
      {loading && <div className="small text-secondary">Checking durable POS sync facts...</div>}
      {!loading && error && (
        <div className="small text-secondary" role="status">
          Central sync status is temporarily unavailable. No transaction or recovery action was attempted.
        </div>
      )}
      {!loading && !error && snapshot && (
        <div className="small" data-sync-state={summary.syncState}>
          <strong>{transactionSyncStatusMessage(summary.syncState)}</strong>
          <div className="text-secondary mt-1">
            Local pending facts: {summary.unpublishedFacts} · Dead-letter facts: {summary.deadLetterFacts}
          </div>
          {summary.syncState === 'blocked' && (
            <div className="text-danger mt-1">
              Use the existing Central-authorized reconciliation flow for recovery; this status is read-only.
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default TransactionSyncStatus;
