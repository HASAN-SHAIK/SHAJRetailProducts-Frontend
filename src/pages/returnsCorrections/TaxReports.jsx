import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReturnsHeader from '../../components/returnsCorrections/ReturnsHeader';
import { getLocalGstEntries } from '../../services/local';
import { fetchGstReports } from '../../services/returnsCorrectionsApi';
import { isLocalPosEnabled } from '../../Repositories/local/posLocalApiClient';
import './ReturnsCorrections.css';

const TaxReports = () => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    const centralReportingRequired = isLocalPosEnabled();
    try {
      if (navigator.onLine) {
        try {
          const serverRows = await fetchGstReports({ from, to });
          setEntries(
            serverRows.map((row) => ({
              date: row.date,
              billId: '-',
              type: 'SUMMARY',
              taxableAmount: 0,
              cgst: row.cgst,
              sgst: row.sgst,
              igst: row.igst,
              gstEntryId: `${row.date}-summary`,
            }))
          );
          return;
        } catch (error) {
          if (centralReportingRequired) {
            setEntries([]);
            setLoadError(
              error?.response?.data?.message ||
              'Central GST reporting is unavailable. Check the connection and retry.'
            );
            return;
          }
        }
      } else if (centralReportingRequired) {
        setEntries([]);
        setLoadError('GST reports require Central reporting authority. Reconnect and retry.');
        return;
      }

      try {
        const list = await getLocalGstEntries({ from, to });
        setEntries(list);
      } catch (error) {
        setEntries([]);
        setLoadError(error?.message || 'Failed to load GST entries. Retry the report.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    const handler = () => loadEntries();
    window.addEventListener('returns-corrections-sync-updated', handler);
    return () => window.removeEventListener('returns-corrections-sync-updated', handler);
  }, [loadEntries]);

  const totals = useMemo(() => {
    return entries.reduce(
      (acc, entry) => {
        acc.cgst += Number(entry.cgst || 0);
        acc.sgst += Number(entry.sgst || 0);
        acc.igst += Number(entry.igst || 0);
        return acc;
      },
      { cgst: 0, sgst: 0, igst: 0 }
    );
  }, [entries]);

  return (
    <div className="returns-page" aria-busy={isLoading}>
      <ReturnsHeader title="Tax Reports" />
      <div className="returns-card">
        <div className="row g-2">
          <div className="col-md-3">
            <label className="form-label" htmlFor="tax-report-from">From</label>
            <input id="tax-report-from" type="date" className="form-control" value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div className="col-md-3">
            <label className="form-label" htmlFor="tax-report-to">To</label>
            <input id="tax-report-to" type="date" className="form-control" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
          <div className="col-md-6">
            <span className="badge-flag">CGST {totals.cgst.toFixed(2)} | SGST {totals.sgst.toFixed(2)} | IGST {totals.igst.toFixed(2)}</span>
          </div>
        </div>
      </div>
      <div className="returns-card">
        {loadError && !isLoading && (
          <div className="alert alert-danger d-flex justify-content-between align-items-center gap-2" role="alert">
            <span>{loadError}</span>
            <button type="button" className="btn btn-outline-danger btn-sm" onClick={loadEntries}>
              Retry GST report
            </button>
          </div>
        )}
        <table className="returns-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Bill</th>
              <th>Type</th>
              <th>Taxable</th>
              <th>CGST</th>
              <th>SGST</th>
              <th>IGST</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="text-center text-secondary" role="status">
                  Loading GST entries...
                </td>
              </tr>
            )}
            {!isLoading && !loadError && entries.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-secondary">
                  No GST entries.
                </td>
              </tr>
            )}
            {!loadError && entries.map((entry) => (
              <tr key={entry.gstEntryId}>
                <td>{entry.date}</td>
                <td>{entry.billId}</td>
                <td>{entry.type}</td>
                <td>{Number(entry.taxableAmount || 0).toFixed(2)}</td>
                <td>{Number(entry.cgst || 0).toFixed(2)}</td>
                <td>{Number(entry.sgst || 0).toFixed(2)}</td>
                <td>{Number(entry.igst || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TaxReports;
