import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReturnsHeader from '../../components/returnsCorrections/ReturnsHeader';
import { getLocalGstEntries } from '../../core/db';
import './ReturnsCorrections.css';

const TaxReports = () => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [entries, setEntries] = useState([]);

  const loadEntries = useCallback(async () => {
    const list = await getLocalGstEntries({ from, to });
    setEntries(list);
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
    <div className="returns-page">
      <ReturnsHeader title="Tax Reports" />
      <div className="returns-card">
        <div className="row g-2">
          <div className="col-md-3">
            <label className="form-label">From</label>
            <input type="date" className="form-control" value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div className="col-md-3">
            <label className="form-label">To</label>
            <input type="date" className="form-control" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
          <div className="col-md-6">
            <span className="badge-flag">CGST {totals.cgst.toFixed(2)} | SGST {totals.sgst.toFixed(2)} | IGST {totals.igst.toFixed(2)}</span>
          </div>
        </div>
      </div>
      <div className="returns-card">
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
            {entries.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-secondary">
                  No GST entries.
                </td>
              </tr>
            )}
            {entries.map((entry) => (
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

