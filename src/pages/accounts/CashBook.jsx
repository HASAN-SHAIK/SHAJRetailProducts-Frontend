import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { canAccessCashBook, getStoredSessionUser } from '../../utils/permissions';
import { fetchCashBook } from '../../services/accountingService';
import { formatInr, toNumber } from '../customers/customerHelpers';
import { getBranchDisplayName } from '../../utils/branchLabels';
import './Accounts.css';

const getTodayDateString = () => new Date().toISOString().slice(0, 10);

export default function CashBook() {
  const storeUser = useSelector((state) => state?.user?.userDetails);
  const user = storeUser || getStoredSessionUser();
  const isAuthorized = canAccessCashBook(user);

  // Connectivity
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Filters
  const [range, setRange] = useState('today');
  const [startDate, setStartDate] = useState(getTodayDateString);
  const [endDate, setEndDate] = useState(getTodayDateString);

  // Data & State
  const [openingBalance, setOpeningBalance] = useState(0);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isOfflineData, setIsOfflineData] = useState(false);

  const branchId = user?.branch_id || user?.store_id || null;
  const branchName = getBranchDisplayName(user, 'Primary Drawer');

  // Network listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadCashBook = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const filters = {
        range: range === 'custom' ? undefined : range,
        start_date: range === 'custom' ? startDate : undefined,
        end_date: range === 'custom' ? endDate : undefined,
        branch_id: branchId,
      };

      const result = await fetchCashBook(filters);
      setOpeningBalance(toNumber(result?.opening_balance || 0));
      const list = Array.isArray(result?.entries) ? result.entries : [];
      setEntries(list);
      setIsOfflineData(Boolean(!navigator.onLine || result?.offline));
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load cash book entries.');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [range, startDate, endDate, branchId]);

  useEffect(() => {
    if (isAuthorized) {
      loadCashBook();
    }
  }, [isAuthorized, loadCashBook]);

  if (!isAuthorized) {
    return <Navigate to="/billing/retail" replace />;
  }

  // Summary computations
  const totalInflow = entries.reduce((acc, curr) => acc + toNumber(curr.debit), 0);
  const totalOutflow = entries.reduce((acc, curr) => acc + toNumber(curr.credit), 0);
  const closingBalance = openingBalance + totalInflow - totalOutflow;

  const handleRangeChange = (newRange) => {
    setRange(newRange);
  };

  return (
    <div className="accounts-container accounts-page">
      <div className="accounts-header-bar">
        <div className="accounts-title-area">
          <h2>Cash Book</h2>
          <span className="accounts-branch-tag">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            {branchName}
          </span>
        </div>
        <div>
          <button
            type="button"
            className="accounts-date-btn"
            onClick={loadCashBook}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {(isOfflineData || !isOnline) && (
        <div className="accounts-offline-alert" role="alert">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>
            <strong>Offline Mode:</strong> Displaying local cached drawer entries. Connect to internet for verified central ledger.
          </span>
        </div>
      )}

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="accounts-summary-cards">
        <div className="accounts-card">
          <div className="accounts-card__label">Opening Cash Float</div>
          <div className="accounts-card__value">{formatInr(openingBalance)}</div>
        </div>
        <div className="accounts-card">
          <div className="accounts-card__label">Total Inflow (Receipts)</div>
          <div className="accounts-card__value accounts-card__value--inflow">+{formatInr(totalInflow)}</div>
        </div>
        <div className="accounts-card">
          <div className="accounts-card__label">Total Outflow (Payments)</div>
          <div className="accounts-card__value accounts-card__value--outflow">-{formatInr(totalOutflow)}</div>
        </div>
        <div className="accounts-card">
          <div className="accounts-card__label">Current Cash in Hand</div>
          <div className="accounts-card__value accounts-card__value--balance">{formatInr(closingBalance)}</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="accounts-filter-bar">
        <div className="accounts-filter-group">
          <button
            type="button"
            className={`accounts-date-btn ${range === 'today' ? 'active' : ''}`}
            onClick={() => handleRangeChange('today')}
          >
            Today
          </button>
          <button
            type="button"
            className={`accounts-date-btn ${range === 'yesterday' ? 'active' : ''}`}
            onClick={() => handleRangeChange('yesterday')}
          >
            Yesterday
          </button>
          <button
            type="button"
            className={`accounts-date-btn ${range === 'this_week' ? 'active' : ''}`}
            onClick={() => handleRangeChange('this_week')}
          >
            This Week
          </button>
          <button
            type="button"
            className={`accounts-date-btn ${range === 'this_month' ? 'active' : ''}`}
            onClick={() => handleRangeChange('this_month')}
          >
            This Month
          </button>
          <button
            type="button"
            className={`accounts-date-btn ${range === 'custom' ? 'active' : ''}`}
            onClick={() => handleRangeChange('custom')}
          >
            Custom
          </button>
        </div>

        {range === 'custom' && (
          <div className="accounts-filter-group" style={{ marginLeft: 'auto' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem' }}>
              From:
              <input
                type="date"
                className="form-control form-control-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem' }}>
              To:
              <input
                type="date"
                className="form-control form-control-sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="accounts-action-btn"
              onClick={loadCashBook}
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {/* Transactions Table */}
      <div className="accounts-table-wrapper">
        <table className="accounts-data-table">
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>Voucher / Ref #</th>
              <th>Type</th>
              <th>Description</th>
              <th style={{ textAlign: 'right' }}>Inflow (Debit)</th>
              <th style={{ textAlign: 'right' }}>Outflow (Credit)</th>
              <th style={{ textAlign: 'right' }}>Running Balance</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="accounts-empty-state">
                  Loading Cash Book transactions...
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan="7" className="accounts-empty-state">
                  No cash transactions recorded for this period.
                </td>
              </tr>
            ) : (
              entries.map((entry, idx) => {
                const dateStr = entry.date || entry.created_at || '';
                const formattedDate = dateStr
                  ? new Date(dateStr).toLocaleString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '-';
                const inflow = toNumber(entry.debit);
                const outflow = toNumber(entry.credit);
                const running = entry.running_balance != null ? toNumber(entry.running_balance) : null;
                const refId = entry.reference_id || entry.transaction_id || entry.id || '-';
                const refType = entry.reference_type || entry.txn_type || 'transaction';

                return (
                  <tr key={entry.id || idx}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formattedDate}</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{refId}</td>
                    <td>
                      <span
                        style={{
                          textTransform: 'uppercase',
                          fontSize: '0.75rem',
                          padding: '2px 6px',
                          background: '#f1f5f9',
                          borderRadius: '4px',
                          fontWeight: 600,
                        }}
                      >
                        {refType}
                      </span>
                    </td>
                    <td>{entry.description || '-'}</td>
                    <td style={{ textAlign: 'right' }}>
                      {inflow > 0 ? (
                        <span className="accounts-inflow-val">+{formatInr(inflow)}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {outflow > 0 ? (
                        <span className="accounts-outflow-val">-{formatInr(outflow)}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }} className="accounts-running-val">
                      {running != null ? formatInr(running) : '-'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
