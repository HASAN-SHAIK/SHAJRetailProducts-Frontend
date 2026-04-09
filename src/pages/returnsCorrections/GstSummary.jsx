import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReturnsHeader from '../../components/returnsCorrections/ReturnsHeader';
import { getLocalGstEntries } from '../../core/db';
import './ReturnsCorrections.css';

const GstSummary = () => {
  const [entries, setEntries] = useState([]);

  const loadEntries = useCallback(async () => {
    const list = await getLocalGstEntries();
    setEntries(list);
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    const handler = () => loadEntries();
    window.addEventListener('returns-corrections-sync-updated', handler);
    return () => window.removeEventListener('returns-corrections-sync-updated', handler);
  }, [loadEntries]);

  const summary = useMemo(() => {
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
