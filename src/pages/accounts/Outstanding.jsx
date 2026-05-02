import React, { useEffect, useState } from 'react';
import { fetchOutstanding } from '../../services/accountingService';
import './Accounts.css';

const Outstanding = () => {
  const [tab, setTab] = useState('customers');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortDir, setSortDir] = useState('desc');
  const [search, setSearch] = useState('');

  const loadOnline = async () => {
    const payload = await fetchOutstanding({ type: tab === 'customers' ? 'customer' : 'supplier' });
    return Array.isArray(payload.rows) ? payload.rows : [];
  };

  const load = async () => {
    setLoading(true);
    try {
      if (!navigator.onLine) {
        setRows([]);
        return;
      }
      const data = await loadOnline();
      setRows(data);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [tab]);

  const filteredRows = rows.filter((row) => {
    const needle = String(search || '').trim().toLowerCase();
    if (!needle) return true;
    return String(row.name || '').toLowerCase().includes(needle);
  });

  const sortedRows = [...filteredRows].sort((a, b) => {
    const left = Number(a.outstanding || 0);
    const right = Number(b.outstanding || 0);
    return sortDir === 'desc' ? right - left : left - right;
  });

  const outstandingClass = (value) => {
    if (!Number.isFinite(value) || value === 0) return '';
    if (tab === 'customers') return value > 0 ? 'text-success' : 'text-danger';
    return value > 0 ? 'text-danger' : 'text-success';
  };

  return (
    <div className="billing-page accounts-page">
      <div className="customers-header">
        <h3>Outstanding</h3>
      </div>
      <div className="billing-filters">
        <div className="btn-group">
          <button
            className={`btn btn-outline-primary${tab === 'customers' ? ' active' : ''}`}
            type="button"
            onClick={() => setTab('customers')}
          >
            Customers
          </button>
          <button
            className={`btn btn-outline-primary${tab === 'suppliers' ? ' active' : ''}`}
            type="button"
            onClick={() => setTab('suppliers')}
          >
            Suppliers
          </button>
        </div>
        <button
          className="btn btn-outline-secondary"
          type="button"
          onClick={() => setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
        >
          Sort Outstanding: {sortDir === 'desc' ? 'High to Low' : 'Low to High'}
        </button>
        <button className="btn btn-outline-secondary" type="button" onClick={load}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
        <input
          className="form-control billing-input"
          style={{ maxWidth: 280 }}
          placeholder={tab === 'customers' ? 'Search customer' : 'Search supplier'}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="billing-table-wrapper">
        <table className="billing-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Total Debit</th>
              <th>Total Credit</th>
              <th>Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="4" className="billing-empty">Loading...</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan="4" className="billing-empty">
                  {navigator.onLine ? 'No data.' : 'Outstanding requires online ledger sync.'}
                </td>
              </tr>
            )}
            {!loading && sortedRows.map((row) => {
              const outstanding = Number(row.outstanding || 0);
              return (
                <tr key={row.id}>
                  <td>{row.name || '-'}</td>
                  <td>INR {Number(row.total_debit || 0).toFixed(2)}</td>
                  <td>INR {Number(row.total_credit || 0).toFixed(2)}</td>
                  <td className={outstandingClass(outstanding)}>
                    INR {outstanding.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Outstanding;
