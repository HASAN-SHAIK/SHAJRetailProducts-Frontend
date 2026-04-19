import React, { useCallback, useEffect, useState } from 'react';
import ReturnsHeader from '../../components/returnsCorrections/ReturnsHeader';
import { getLocalCorrections } from '../../core/db';
import './ReturnsCorrections.css';

const CorrectionHistory = () => {
  const [corrections, setCorrections] = useState([]);

  const loadCorrections = useCallback(async () => {
    const list = await getLocalCorrections();
    setCorrections(list);
  }, []);

  useEffect(() => {
    loadCorrections();
  }, [loadCorrections]);

  useEffect(() => {
    const handler = () => loadCorrections();
    window.addEventListener('returns-corrections-sync-updated', handler);
    return () => window.removeEventListener('returns-corrections-sync-updated', handler);
  }, [loadCorrections]);

  return (
    <div className="returns-page">
      <ReturnsHeader title="Correction History" />
      <div className="returns-card">
        <table className="returns-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Correction ID</th>
              <th>Bill</th>
              <th>Type</th>
              <th>Adjusted Amount</th>
              <th>Tax Adjustment</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {corrections.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-secondary">
                  No corrections yet.
                </td>
              </tr>
            )}
            {corrections.map((row) => (
              <tr key={row.correctionId}>
                <td>{row.isSynced ? 'Synced' : 'Not Synced'}</td>
                <td>{row.correctionId}</td>
                <td>{row.billId}</td>
                <td>{row.type}</td>
                <td>{Number(row.adjustedAmount || 0).toFixed(2)}</td>
                <td>{Number(row.taxAdjustment || 0).toFixed(2)}</td>
                <td>{row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-IN') : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CorrectionHistory;

