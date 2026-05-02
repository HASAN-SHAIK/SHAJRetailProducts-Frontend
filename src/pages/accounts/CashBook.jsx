import React, { useEffect, useMemo, useState } from 'react';
import { fetchCashBook } from '../../services/accountingService';
import './Accounts.css';

const normalizeEntryAmount = (entry) => Number(entry.amount ?? entry.total_price ?? entry.debit ?? entry.credit ?? 0);
const normalizeInAmount = (entry) => Number(entry.debit ?? (String(entry.direction || '').toLowerCase() === 'in' ? normalizeEntryAmount(entry) : 0));
const normalizeOutAmount = (entry) => Number(entry.credit ?? (String(entry.direction || '').toLowerCase() === 'out' ? normalizeEntryAmount(entry) : 0));

const applyRunningBalance = (entries = []) => {
  const sorted = [...entries].sort((a, b) => new Date(a.date || a.created_at || 0) - new Date(b.date || b.created_at || 0));
  let running = 0;
  const withBalance = sorted.map((entry) => {
    const inAmount = normalizeInAmount(entry);
    const outAmount = normalizeOutAmount(entry);
    running += inAmount - outAmount;
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
      const payload = await fetchCashBook({
        ...filters,
        range: filters.start_date && filters.end_date ? 'custom' : 'all',
      });
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
    return [...list].sort((a, b) => new Date(b.date || b.created_at || 0) - new Date(a.date || a.created_at || 0));
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
              const inAmount = normalizeInAmount(entry);
              const outAmount = normalizeOutAmount(entry);
              const type = entry.txn_type || entry.reference_type || (entry.description ? 'ledger' : '-');
              const party = entry.party_name || entry.party_id || entry.description || '-';
              const rowDate = entry.date || entry.created_at;
              return (
                <tr key={entry.id || `${rowDate || ''}-${entry.ledger_id || ''}-${entry.reference_id || ''}`}>
                  <td>{rowDate ? new Date(rowDate).toLocaleDateString() : '-'}</td>
                  <td>{type}</td>
                  <td>{party}</td>
                  <td>{inAmount > 0 ? `INR ${inAmount.toFixed(2)}` : '-'}</td>
                  <td>{outAmount > 0 ? `INR ${outAmount.toFixed(2)}` : '-'}</td>
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
