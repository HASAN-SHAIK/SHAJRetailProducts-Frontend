import React, { useCallback, useEffect, useState } from 'react';
import ReturnsHeader from '../../components/returnsCorrections/ReturnsHeader';
import { getLocalGstEntries } from '../../core/db';
import { fetchGstFilingData } from '../../services/returnsCorrectionsApi';
import './ReturnsCorrections.css';

const GstFilingData = () => {
  const [data, setData] = useState({ b2b: [], b2c: [], credit_notes: [], raw: [] });

  const loadEntries = useCallback(async () => {
    if (navigator.onLine) {
      try {
        const filingData = await fetchGstFilingData();
        setData(filingData || { b2b: [], b2c: [], credit_notes: [], raw: [] });
        return;
      } catch {
        // fallback to local
      }
    }

    const localEntries = await getLocalGstEntries();
    setData({
      b2b: [],
      b2c: [],
      credit_notes: localEntries.filter((entry) => entry.type === 'RETURN'),
      raw: localEntries,
    });
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  return (
    <div className="returns-page">
      <ReturnsHeader title="GST Filing Data" />
      <div className="returns-card">
        <pre style={{ whiteSpace: 'pre-wrap', color: '#e2e8f0' }}>
{JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default GstFilingData;
