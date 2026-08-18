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
              taxableAmount: row.taxable_amount ?? 0,
              totalGst: row.total_gst ?? null,
              cgst: row.cgst ?? null,
              sgst: row.sgst ?? null,
              igst: row.igst ?? null,
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
        const cgst = Number(entry.cgst || 0);
        const sgst = Number(entry.sgst || 0);
        const igst = Number(entry.igst || 0);
        acc.cgst += cgst;
        acc.sgst += sgst;
        acc.igst += igst;
        acc.totalGst += Number(entry.totalGst ?? entry.totalTax ?? (cgst + sgst + igst));
        return acc;
      },
      { cgst: 0, sgst: 0, igst: 0, totalGst: 0 }
    );
  }, [entries]);

  const hasComponentBreakdown = useMemo(
    () => entries.some((entry) => entry.cgst != null || entry.sgst != null || entry.igst != null),
    [entries]
  );

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
            <span className="badge-flag">
              GST {totals.totalGst.toFixed(2)}
              {hasComponentBreakdown && ` | CGST ${totals.cgst.toFixed(2)} | SGST ${totals.sgst.toFixed(2)} | IGST ${totals.igst.toFixed(2)}`}
            </span>
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
              <th>Total GST</th>
              <th>CGST</th>
              <th>SGST</th>
              <th>IGST</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="text-center text-secondary" role="status">
                  Loading GST entries...
                </td>
              </tr>
            )}
            {!isLoading && !loadError && entries.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-secondary">
                  No GST entries.
                </td>
              </tr>
            )}
            {!loadError && entries.map((entry) => {
              const cgst = entry.cgst == null ? null : Number(entry.cgst);
              const sgst = entry.sgst == null ? null : Number(entry.sgst);
              const igst = entry.igst == null ? null : Number(entry.igst);
              const totalGst = Number(entry.totalGst ?? entry.totalTax ?? ((cgst || 0) + (sgst || 0) + (igst || 0)));
              return (
                <tr key={entry.gstEntryId}>
                  <td>{entry.date}</td>
                  <td>{entry.billId}</td>
                  <td>{entry.type}</td>
                  <td>{Number(entry.taxableAmount || 0).toFixed(2)}</td>
                  <td>{totalGst.toFixed(2)}</td>
                  <td>{cgst == null ? '—' : cgst.toFixed(2)}</td>
                  <td>{sgst == null ? '—' : sgst.toFixed(2)}</td>
                  <td>{igst == null ? '—' : igst.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!isLoading && !loadError && entries.length > 0 && !hasComponentBreakdown && (
          <p className="text-secondary small mt-2 mb-0" role="note">
            Jurisdiction component split is unavailable for these canonical POS tax snapshots; totals are shown without inventing CGST/SGST/IGST allocation.
          </p>
        )}
      </div>
    </div>
  );
};

export default TaxReports;
