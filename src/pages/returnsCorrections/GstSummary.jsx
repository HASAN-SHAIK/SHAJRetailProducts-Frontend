import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReturnsHeader from '../../components/returnsCorrections/ReturnsHeader';
import { getLocalGstEntries } from '../../core/db';
import { fetchGstLedger, fetchGstSummary } from '../../services/returnsCorrectionsApi';
import './ReturnsCorrections.css';

const GstSummary = () => {
  const [entries, setEntries] = useState([]);
  const [serverSummary, setServerSummary] = useState(null);

  const loadEntries = useCallback(async () => {
    if (navigator.onLine) {
      try {
        const [ledgerRows, summary] = await Promise.all([fetchGstLedger(), fetchGstSummary()]);
        setEntries(ledgerRows);
        setServerSummary(summary);
        return;
      } catch {
        // fallback to local cache
      }
    }
    const list = await getLocalGstEntries();
    setEntries(list);
    setServerSummary(null);
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    const handler = () => loadEntries();
    window.addEventListener('returns-corrections-sync-updated', handler);
    return () => window.removeEventListener('returns-corrections-sync-updated', handler);
  }, [loadEntries]);

  const fallbackSummary = useMemo(() => {
    let sales = 0;
    let returns = 0;
    let totalTax = 0;
    entries.forEach((entry) => {
      const taxable = Number(entry.taxableAmount || 0);
      if (entry.type === 'RETURN') {
        returns += taxable;
      } else if (entry.type === 'SALE') {
        sales += taxable;
      }
      totalTax += Number(entry.totalTax || 0);
    });
    return {
      sales,
      returns,
      netTax: totalTax,
    };
  }, [entries]);

  const summary = {
    sales: Number(serverSummary?.total_sales ?? fallbackSummary.sales ?? 0),
    returns: Number(serverSummary?.total_returns ?? fallbackSummary.returns ?? 0),
    netTax: Number(serverSummary?.net_tax_liability ?? fallbackSummary.netTax ?? 0),
  };

  return (
    <div className="returns-page">
      <ReturnsHeader title="GST Summary" />
      <div className="returns-card">
        <div className="row g-2">
          <div className="col-md-4">
            <span className="badge-flag">Total Sales: {summary.sales.toFixed(2)}</span>
          </div>
          <div className="col-md-4">
            <span className="badge-flag">Total Returns: {summary.returns.toFixed(2)}</span>
          </div>
          <div className="col-md-4">
            <span className="badge-flag">Net Tax: {summary.netTax.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GstSummary;
