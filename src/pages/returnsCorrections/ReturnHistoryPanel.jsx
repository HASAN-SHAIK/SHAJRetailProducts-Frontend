import React, { useEffect, useMemo, useState } from 'react';
import { getLocalOrderReturnHistory } from '../../services/local';
import RefundReconciliationPanel from './RefundReconciliationPanel';
import { summarizeReturnHistory } from './returnHistoryPolicy';

const ReturnHistoryPanel = ({ orderId, enabled, refreshKey = 0 }) => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    if (!enabled || !orderId) {
      setRecords([]);
      setError('');
      setLoading(false);
      return () => { cancelled = true; };
    }

    setLoading(true);
    setError('');
    getLocalOrderReturnHistory(orderId)
      .then((result) => {
        if (!cancelled) setRecords(result.items || []);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setRecords([]);
          setError(requestError?.message || 'return_history_lookup_failed');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [enabled, orderId, refreshKey]);

  const history = useMemo(() => summarizeReturnHistory(records), [records]);

  if (!enabled || !orderId) return null;

  return (
    <>
      <RefundReconciliationPanel
        orderId={orderId}
        enabled={enabled}
        refreshKey={refreshKey}
      />

      <div className="returns-card" data-testid="local-pos-return-history">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <strong>Partial return history</strong>
          {!loading && !error && <span className="small text-secondary">{history.length} operation(s)</span>}
        </div>

        {loading && <div className="small text-secondary">Loading return history...</div>}
        {!loading && error && (
          <div className="small text-danger">
            Return history is temporarily unavailable. Refund execution is unaffected; refresh the bill to retry.
          </div>
        )}
        {!loading && !error && history.length === 0 && (
          <div className="small text-secondary">No partial returns have been recorded for this bill.</div>
        )}

        {!loading && !error && history.map((record) => (
          <div key={record.returnId} className="border rounded p-2 mb-2">
            <div className="d-flex flex-wrap gap-3 small">
              <span><strong>Return:</strong> {record.returnId}</span>
              <span><strong>Refund:</strong> {record.refundAmount}</span>
              <span><strong>Approved by:</strong> {record.approvedByUserId || '-'}</span>
              <span><strong>At:</strong> {record.createdAt || '-'}</span>
            </div>
            <div className="small mt-1"><strong>Reason:</strong> {record.reason || '-'}</div>
            <div className="small mt-1">
              {record.lines.map((line) => (
                <div key={`${record.returnId}-${line.orderItemId}`}>
                  Item {line.orderItemId}: {line.quantity} returned / {line.refundAmount} refunded
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default ReturnHistoryPanel;
