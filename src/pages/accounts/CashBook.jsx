import React, { useEffect, useMemo, useState } from 'react';
import { fetchCashBook } from '../../services/accountingService';
import './Accounts.css';

const normalizeEntryAmount = (entry) => Number(entry.amount ?? entry.total_price ?? entry.debit ?? entry.credit ?? 0);
const normalizeInAmount = (entry) => Number(entry.debit ?? (String(entry.direction || '').toLowerCase() === 'in' ? normalizeEntryAmount(entry) : 0));
const normalizeOutAmount = (entry) => Number(entry.credit ?? (String(entry.direction || '').toLowerCase() === 'out' ? normalizeEntryAmount(entry) : 0));
const isOpeningEntry = (entry) => {
  const refType = String(entry?.reference_type || '').toLowerCase();
  const txnType = String(entry?.txn_type || '').toLowerCase();
  return refType === 'opening' || txnType === 'opening';
};
const toDateKey = (entry) => {
  const raw = entry?.date || entry?.created_at;
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};
const toEpoch = (entry) => {
  const raw = entry?.date || entry?.created_at;
  const ts = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(ts) ? ts : 0;
};
const formatDateTime = (value) => {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleString();
};
const normalizeCashBookEntries = (entries = []) => {
  const list = Array.isArray(entries) ? entries : [];
  const asc = [...list].sort((a, b) => {
    const ra = isOpeningEntry(a) ? 0 : 1;
    const rb = isOpeningEntry(b) ? 0 : 1;
    if (ra !== rb) return ra - rb;
    const da = toDateKey(a);
    const db = toDateKey(b);
    if (da !== db) return da.localeCompare(db);
    const ta = toEpoch(a);
    const tb = toEpoch(b);
    if (ta !== tb) return ta - tb;
    const ca = a?.created_at ? new Date(a.created_at).getTime() : ta;
    const cb = b?.created_at ? new Date(b.created_at).getTime() : tb;
    if (ca !== cb) return ca - cb;
    return Number(a?.id || 0) - Number(b?.id || 0);
  });
  let balance = 0;
  const withBalance = asc.map((entry) => {
    balance += normalizeInAmount(entry);
    balance -= normalizeOutAmount(entry);
    return { ...entry, running_balance: balance };
  });
  return withBalance.reverse();
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
      setEntries(normalizeCashBookEntries(list));
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filters]);

  const rows = useMemo(() => entries || [], [entries]);

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
              const rowDate = entry.created_at || entry.date;
              return (
                <tr key={entry.id || `${rowDate || ''}-${entry.ledger_id || ''}-${entry.reference_id || ''}`}>
                  <td>{formatDateTime(rowDate)}</td>
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
