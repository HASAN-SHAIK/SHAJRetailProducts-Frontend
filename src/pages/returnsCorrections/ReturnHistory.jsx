import React, { useCallback, useEffect, useState } from 'react';
import ReturnsHeader from '../../components/returnsCorrections/ReturnsHeader';
import { getLocalSalesReturns } from '../../core/db';
import { fetchReturns } from '../../services/returnsCorrectionsApi';
import './ReturnsCorrections.css';

const ReturnHistory = () => {
  const [returns, setReturns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadReturns = useCallback(async () => {
    setIsLoading(true);
    try {
      if (navigator.onLine) {
        try {
          const serverRows = await fetchReturns();
          setReturns(
            serverRows.map((row) => ({
              ...row,
              isSynced: true,
            }))
          );
          return;
        } catch {
          // fallback to local cache
        }
      }
      const list = await getLocalSalesReturns();
      setReturns(list);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReturns();
  }, []);

  useEffect(() => {
    const handler = () => loadReturns();
    window.addEventListener('returns-corrections-sync-updated', handler);
    return () => window.removeEventListener('returns-corrections-sync-updated', handler);
  }, [loadReturns]);

  return (
    <div className="returns-page">
      <ReturnsHeader title="Return History" />
      <div className="returns-card">
        <table className="returns-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Return ID</th>
              <th>Bill</th>
              <th>Refund</th>
              <th>Tax Reversed</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="text-center text-secondary">
                  Loading returns...
                </td>
              </tr>
            )}
            {!isLoading && returns.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-secondary">
                  No returns yet.
                </td>
              </tr>
            )}
            {returns.map((row) => (
              <tr key={row.returnId || row.returnDbId}>
                <td>{row.isSynced ? 'Synced' : 'Not Synced'}</td>
                <td>{row.returnId}</td>
                <td>{row.originalBillId}</td>
                <td>{Number(row.refundAmount || 0).toFixed(2)}</td>
                <td>{Number(row.taxReversed || 0).toFixed(2)}</td>
                <td>{row.date ? new Date(row.date).toLocaleDateString('en-IN') : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReturnHistory;
