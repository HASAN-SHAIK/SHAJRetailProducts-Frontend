import React, { useEffect, useMemo, useState } from 'react';
import { fetchCashBook } from '../../services/accountingService';
import './Accounts.css';

const normalizeEntryAmount = (entry) => Number(entry.amount ?? entry.total_price ?? 0);

const applyRunningBalance = (entries = []) => {
  const sorted = [...entries].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  let running = 0;
  const withBalance = sorted.map((entry) => {
    const amount = normalizeEntryAmount(entry);
    const direction = String(entry.direction || '').toLowerCase();
    running += direction === 'out' ? -amount : amount;
    return { ...entry, running_balance: running };
  });
  return withBalance;
};

const CashBook = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ start_date: '', end_date: '' });

  const load = async () => {
    setLoading(true);
    try {
      const payload = await fetchCashBook(filters);
      const list = Array.isArray(payload.entries) ? payload.entries : [];
      const withBalance = list.some((entry) => entry.running_balance !== undefined)
        ? list
        : applyRunningBalance(list);
      setEntries(withBalance);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filters]);

  const rows = useMemo(() => {
    const list = entries || [];
    return [...list].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [entries]);

  return (
    <div className="billing-page accounts-page">
      <div className="customers-header">
        <h3>Cash Book</h3>
      </div>
      <div className="billing-filters">
        <input
          className="form-control billing-input"
          type="date"
          value={filters.start_date}
          onChange={(event) => setFilters((prev) => ({ ...prev, start_date: event.target.value }))}
        />
        <input
          className="form-control billing-input"
          type="date"
          value={filters.end_date}
          onChange={(event) => setFilters((prev) => ({ ...prev, end_date: event.target.value }))}
        />
        <button className="btn btn-outline-secondary" type="button" onClick={load}>
          Refresh
        </button>
      </div>
      <div className="billing-table-wrapper">
        <table className="billing-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Party</th>
              <th>In</th>
              <th>Out</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="6" className="billing-empty">Loading...</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan="6" className="billing-empty">No entries found.</td>
              </tr>
            )}
            {!loading && rows.map((entry) => {
              const amount = normalizeEntryAmount(entry);
              const direction = String(entry.direction || '').toLowerCase();
              return (
                <tr key={entry.id}>
                  <td>{entry.created_at ? new Date(entry.created_at).toLocaleDateString() : '-'}</td>
                  <td>{entry.txn_type || '-'}</td>
                  <td>{entry.party_name || entry.party_id || '-'}</td>
                  <td>{direction === 'in' ? `INR ${amount.toFixed(2)}` : '-'}</td>
                  <td>{direction === 'out' ? `INR ${amount.toFixed(2)}` : '-'}</td>
                  <td>INR {Number(entry.running_balance || 0).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CashBook;
