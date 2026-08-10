import React, { useEffect, useMemo, useState } from 'react';
import { getLocalOrderRefundReconciliation, recoverLocalRefundSync } from '../../services/local';
import { summarizeRefundReconciliation } from './refundReconciliationPolicy';

const RefundReconciliationPanel = ({ orderId, enabled, refreshKey = 0 }) => {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recoveryReason, setRecoveryReason] = useState('');
  const [recovering, setRecovering] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [recoveryRefreshKey, setRecoveryRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    if (!enabled || !orderId) {
      setSnapshot(null);
      setError('');
      setLoading(false);
      setRecoveryReason('');
      setRecoveryMessage('');
      return () => { cancelled = true; };
    }

    setLoading(true);
    setError('');
    getLocalOrderRefundReconciliation(orderId)
      .then((result) => {
        if (!cancelled) setSnapshot(result || null);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setSnapshot(null);
          setError(requestError?.message || 'refund_reconciliation_lookup_failed');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [enabled, orderId, refreshKey, recoveryRefreshKey]);

  const summary = useMemo(
    () => summarizeRefundReconciliation(snapshot || {}),
    [snapshot]
  );

  if (!enabled || !orderId) return null;

  const hasMismatch = summary.hasPaymentMismatch || summary.hasInventoryMismatch;
  const deadLetterHead = snapshot?.dead_letter_sync_head || null;
  const deadLetterEventId = String(deadLetterHead?.event_id || '').trim();
  const canRequestRecovery = Boolean(deadLetterEventId && recoveryReason.trim() && !recovering);

  const handleRecovery = async () => {
    if (!canRequestRecovery) return;

    setRecovering(true);
    setRecoveryMessage('');
    try {
      await recoverLocalRefundSync({
        orderId,
        eventId: deadLetterEventId,
        reason: recoveryReason.trim(),
      });
      setRecoveryReason('');
      setRecoveryMessage('Central authorized recovery was accepted. Refreshing reconciliation facts.');
      setRecoveryRefreshKey((value) => value + 1);
    } catch (recoveryError) {
      const recoveryCode = String(recoveryError?.message || 'sync_recovery_failed');
      if (recoveryCode.includes('sync_recovery_grant_consumed')) {
        setRecoveryMessage('This Central recovery authorization was already consumed. Reconciliation was refreshed; request a new manager authorization only if the exact dead-letter head still exists.');
        setRecoveryRefreshKey((value) => value + 1);
      } else {
        setRecoveryMessage(`Recovery was not applied: ${recoveryCode}. Central manager authorization is required and the exact dead-letter scope must match.`);
      }
    } finally {
      setRecovering(false);
    }
  };

  return (
    <div className="returns-card" data-testid="local-pos-refund-reconciliation">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <strong>Refund reconciliation</strong>
        {!loading && !error && snapshot && (
          <span className="small text-secondary">Status: {summary.orderStatus || '-'}</span>
        )}
      </div>

      {loading && <div className="small text-secondary">Loading reconciliation facts...</div>}
      {!loading && error && (
        <div className="small text-danger">
          Reconciliation facts are temporarily unavailable. No corrective action was attempted.
        </div>
      )}

      {!loading && !error && snapshot && (
        <>
          <div className="small mb-2" data-testid="refund-sync-operator-state">
            <strong>Central sync:</strong>{' '}
            {summary.syncState === 'blocked'
              ? 'Blocked — manager-authorized recovery required.'
              : summary.syncState === 'pending'
                ? 'Pending — durable local refund facts are waiting for Central.'
                : 'Clear — no local refund sync facts are pending.'}
          </div>

          <div className="row g-2 small">
            <div className="col-md-4"><strong>Captured:</strong> {summary.capturedAmount.toFixed(2)}</div>
            <div className="col-md-4"><strong>Reversed:</strong> {summary.reversedAmount.toFixed(2)}</div>
            <div className="col-md-4"><strong>Payment remaining:</strong> {summary.paymentDelta.toFixed(2)}</div>
            <div className="col-md-4"><strong>Issued qty:</strong> {summary.issuedQuantity}</div>
            <div className="col-md-4"><strong>Restored qty:</strong> {summary.restoredQuantity}</div>
            <div className="col-md-4"><strong>Inventory remaining:</strong> {summary.inventoryDelta}</div>
            <div className="col-md-4"><strong>Partial returns:</strong> {summary.partialReturnOperations}</div>
            <div className="col-md-4"><strong>Partial refund total:</strong> {summary.partialRefundAmount.toFixed(2)}</div>
            <div className="col-md-4"><strong>Unpublished sync facts:</strong> {summary.unpublishedSyncFacts}</div>
            <div className="col-md-4"><strong>Dead-letter sync facts:</strong> {summary.deadLetterSyncFacts}</div>
          </div>

          {summary.hasDeadLetterSyncFacts && (
            <div className="small text-danger mt-2" role="alert">
              Refund sync is blocked by a dead-lettered durable fact. Recovery requires Central manager authorization for the exact poisoned event; this screen cannot skip or directly retry it.
            </div>
          )}

          {deadLetterEventId && (
            <div className="mt-3" data-testid="central-authorized-refund-sync-recovery">
              <div className="small mb-1">
                <strong>Blocked event:</strong> {deadLetterHead?.event_type || '-'} ({deadLetterEventId})
              </div>
              <label className="form-label small mb-1" htmlFor={`sync-recovery-reason-${orderId}`}>
                Manager recovery reason
              </label>
              <textarea
                id={`sync-recovery-reason-${orderId}`}
                className="form-control form-control-sm"
                rows={2}
                value={recoveryReason}
                onChange={(event) => setRecoveryReason(event.target.value)}
                disabled={recovering}
                placeholder="Required for Central authorization"
              />
              <button
                type="button"
                className="btn btn-outline-danger btn-sm mt-2"
                disabled={!canRequestRecovery}
                onClick={handleRecovery}
              >
                {recovering ? 'Requesting Central authorization...' : 'Request manager-authorized recovery'}
              </button>
              <div className="small text-secondary mt-1">
                Central verifies the signed-in user has canonical POS approval authority before POS can requeue this exact event.
              </div>
              {recoveryMessage && (
                <div className="small mt-2" role="status">{recoveryMessage}</div>
              )}
            </div>
          )}

          {hasMismatch && (
            <div className="small text-danger mt-2" role="alert">
              Local durable facts contain an impossible over-reversal or over-restoration. Do not retry the refund until the sale is reconciled.
            </div>
          )}
          {!summary.hasDeadLetterSyncFacts && !hasMismatch && summary.unpublishedSyncFacts > 0 && (
            <div className="small text-secondary mt-2">
              Refund facts are still awaiting Central sync; this panel is read-only.
            </div>
          )}
          {!hasMismatch && (summary.paymentDelta !== 0 || summary.inventoryDelta !== 0) && (
            <div className="small text-secondary mt-2">
              Remaining payment/inventory reflects the current durable partial-return state; this panel is read-only.
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default RefundReconciliationPanel;
