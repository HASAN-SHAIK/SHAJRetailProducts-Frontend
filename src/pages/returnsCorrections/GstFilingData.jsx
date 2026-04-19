import React, { useCallback, useEffect, useState } from 'react';
import ReturnsHeader from '../../components/returnsCorrections/ReturnsHeader';
import { getLocalGstEntries } from '../../core/db';
import './ReturnsCorrections.css';

const GstFilingData = () => {
  const [entries, setEntries] = useState([]);

  const loadEntries = useCallback(async () => {
    const list = await getLocalGstEntries();
    setEntries(list);
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  return (
    <div className="returns-page">
      <ReturnsHeader title="GST Filing Data" />
      <div className="returns-card">
        <pre style={{ whiteSpace: 'pre-wrap', color: '#e2e8f0' }}>
{JSON.stringify(
  {
    b2b: [],
    b2c: [],
    credit_notes: entries.filter((entry) => entry.type === 'RETURN'),
    raw: entries,
  },
  null,
  2
)}
        </pre>
      </div>
    </div>
  );
};

export default GstFilingData;
