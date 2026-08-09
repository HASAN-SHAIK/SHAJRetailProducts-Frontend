import React, { useEffect, useMemo, useState } from 'react';
import { getLocalOrderRefundReconciliation } from '../../services/local';
import { summarizeRefundReconciliation } from './refundReconciliationPolicy';

const RefundReconciliationPanel = ({ orderId, enabled, refreshKey = 0 }) => {
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
  }, [enabled, orderId, refreshKey]);

  const summary = useMemo(
    () => summarizeRefundReconciliation(snapshot || {}),
    [snapshot]
  );

  if (!enabled || !orderId) return null;

  const hasMismatch = summary.hasPaymentMismatch || summary.hasInventoryMismatch;

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
          <div className="row g-2 small">
            <div className="col-md-4"><strong>Captured:</strong> {summary.capturedAmount.toFixed(2)}</div>
            <div className="col-md-4"><strong>Reversed:</strong> {summary.reversedAmount.toFixed(2)}</div>
            <div className="col-md-4"><strong>Payment remaining:</strong> {summary.paymentDelta.toFixed(2)}</div>
            <div className="col-md-4"><strong>Issued qty:</strong> {summary.issuedQuantity}</div>
            <div className="col-md-4"><strong>Restored qty:</strong> {summary.restoredQuantity}</div>
            <div className="col-md-4"><strong>Inventory remaining:</strong> {summary.inventoryDelta}</div>
            <div className="col-md-4"><strong>Partial returns:</strong> {summary.partialReturnOperations}</div>
            <div className="col-md-4"><strong>Partial refund total:</strong> {summary.partialRefundAmount.toFixed(2)}</div>
          </div>

          {hasMismatch && (
            <div className="small text-danger mt-2" role="alert">
              Local durable facts contain an impossible over-reversal or over-restoration. Do not retry the refund until the sale is reconciled.
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
