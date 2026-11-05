import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  canAccessOutstanding,
  canAccessSupplierOutstanding,
  getStoredSessionUser,
} from '../../utils/permissions';
import { fetchOutstanding } from '../../services/accountingService';
import { formatInr, toNumber } from '../customers/customerHelpers';
import './Accounts.css';

export default function Outstanding() {
  const navigate = useNavigate();
  const storeUser = useSelector((state) => state?.user?.userDetails);
  const user = storeUser || getStoredSessionUser();
  const isAuthorized = canAccessOutstanding(user);
  const canViewSuppliers = canAccessSupplierOutstanding(user);

  // Connectivity
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Tab: 'customer' or 'supplier'
  const [activeTab, setActiveTab] = useState('customer');
  const [search, setSearch] = useState('');

  // Data & State
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isOfflineData, setIsOfflineData] = useState(false);

  const branchId = user?.branch_id || user?.store_id || null;

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

  const loadOutstanding = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const type = activeTab === 'supplier' && canViewSuppliers ? 'supplier' : 'customer';
      const result = await fetchOutstanding({
        type,
        branch_id: branchId,
      });

      const list = Array.isArray(result?.rows) ? result.rows : [];
      setRows(list);
      setIsOfflineData(Boolean(!navigator.onLine || result?.offline));
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load outstanding balances.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, canViewSuppliers, branchId]);

  useEffect(() => {
    if (isAuthorized) {
      loadOutstanding();
    }
  }, [isAuthorized, loadOutstanding]);

  if (!isAuthorized) {
    return <Navigate to="/billing/retail" replace />;
  }

  // Filtered rows by search term
  const filteredRows = rows.filter((row) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const nameMatch = String(row.name || '').toLowerCase().includes(term);
    const idMatch = String(row.id || '').toLowerCase().includes(term);
    return nameMatch || idMatch;
  });

  // Summary computations
  const totalOutstanding = filteredRows.reduce((acc, curr) => acc + toNumber(curr.outstanding), 0);
  const totalAccounts = filteredRows.length;
  const highestBalance = filteredRows.reduce((max, curr) => Math.max(max, toNumber(curr.outstanding)), 0);

  const handleTabSwitch = (tab) => {
    if (tab === 'supplier' && !canViewSuppliers) return;
    setActiveTab(tab);
    setSearch('');
  };

  const handleCollectReceipt = (customer) => {
    const custId = encodeURIComponent(customer.id);
    const custName = encodeURIComponent(customer.name || '');
    const amountVal = encodeURIComponent(customer.outstanding || 0);
    navigate(`/accounts/receipt?customerId=${custId}&customerName=${custName}&amount=${amountVal}`);
  };

  const handlePaySupplier = (supplier) => {
    const suppId = encodeURIComponent(supplier.id);
    const suppName = encodeURIComponent(supplier.name || '');
    const amountVal = encodeURIComponent(supplier.outstanding || 0);
    navigate(`/accounts/payment?supplierId=${suppId}&supplierName=${suppName}&amount=${amountVal}`);
  };

  return (
    <div className="accounts-container accounts-page">
      <div className="accounts-header-bar">
        <div className="accounts-title-area">
          <h2>Outstanding Balances</h2>
        </div>
        <div>
          <button
            type="button"
            className="accounts-date-btn"
            onClick={loadOutstanding}
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
            <strong>Offline Mode:</strong> Live outstanding credit balances require central accounting connectivity. Displaying local cached status.
          </span>
        </div>
      )}

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="accounts-tabs-nav">
        <button
          type="button"
          className={`accounts-tab-btn ${activeTab === 'customer' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('customer')}
        >
          Customer Receivables
        </button>
        {canViewSuppliers && (
          <button
            type="button"
            className={`accounts-tab-btn ${activeTab === 'supplier' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('supplier')}
          >
            Supplier Payables
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="accounts-summary-cards">
        <div className="accounts-card">
          <div className="accounts-card__label">
            {activeTab === 'customer' ? 'Total Receivables (Due In)' : 'Total Payables (Due Out)'}
          </div>
          <div
            className={`accounts-card__value ${
              activeTab === 'customer' ? 'accounts-card__value--inflow' : 'accounts-card__value--outflow'
            }`}
          >
            {formatInr(totalOutstanding)}
          </div>
        </div>
        <div className="accounts-card">
          <div className="accounts-card__label">Accounts with Balance</div>
          <div className="accounts-card__value">{totalAccounts}</div>
        </div>
        <div className="accounts-card">
          <div className="accounts-card__label">Highest Outstanding Balance</div>
          <div className="accounts-card__value accounts-card__value--balance">{formatInr(highestBalance)}</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="accounts-filter-bar">
        <div style={{ flex: '1 1 300px' }}>
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder={
              activeTab === 'customer'
                ? 'Search customer by name or ID...'
                : 'Search supplier by name or ID...'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {search && (
          <button
            type="button"
            className="accounts-date-btn"
            onClick={() => setSearch('')}
          >
            Clear Search
          </button>
        )}
      </div>

      {/* Accounts Outstanding Table */}
      <div className="accounts-table-wrapper">
        <table className="accounts-data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>{activeTab === 'customer' ? 'Customer Name' : 'Supplier Name'}</th>
              <th style={{ textAlign: 'right' }}>Total Debit</th>
              <th style={{ textAlign: 'right' }}>Total Credit</th>
              <th style={{ textAlign: 'right' }}>Outstanding Amount</th>
              <th style={{ textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="accounts-empty-state">
                  Loading outstanding balances...
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan="6" className="accounts-empty-state">
                  {search
                    ? 'No matching accounts found for search term.'
                    : activeTab === 'customer'
                    ? 'No outstanding customer balances.'
                    : 'No outstanding supplier balances.'}
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const outstanding = toNumber(row.outstanding);
                return (
                  <tr key={row.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>#{row.id}</td>
                    <td style={{ fontWeight: 600 }}>{row.name || `Account #${row.id}`}</td>
                    <td style={{ textAlign: 'right' }}>{formatInr(row.total_debit)}</td>
                    <td style={{ textAlign: 'right' }}>{formatInr(row.total_credit)}</td>
                    <td
                      style={{ textAlign: 'right' }}
                      className={
                        activeTab === 'customer'
                          ? 'accounts-inflow-val'
                          : 'accounts-outflow-val'
                      }
                    >
                      {formatInr(outstanding)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {activeTab === 'customer' ? (
                        <button
                          type="button"
                          className="accounts-action-btn"
                          onClick={() => handleCollectReceipt(row)}
                          title="Collect payment in Receipt Entry"
                        >
                          Collect Payment
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="accounts-action-btn"
                          onClick={() => handlePaySupplier(row)}
                          title="Record payment in Payment Entry"
                        >
                          Pay Supplier
                        </button>
                      )}
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
