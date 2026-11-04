import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchCustomers } from '../../services/local';
import { formatInr, getAvailableCredit, isOverCreditLimit } from './customerHelpers';
import './Customers.css';

const SEARCH_DEBOUNCE_MS = 300;

const CustomerList = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && !navigator.onLine);
  const requestIdRef = useRef(0);

  const loadCustomers = useCallback(async (term) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError('');
    try {
      const list = await searchCustomers({ search: term || undefined, limit: 500 });
      // Ignore out-of-order responses from an older search.
      if (requestId !== requestIdRef.current) return;
      setCustomers(Array.isArray(list) ? list : []);
    } catch {
      if (requestId !== requestIdRef.current) return;
      setCustomers([]);
      setError('Could not load customers. Check the connection and try again.');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => loadCustomers(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, loadCustomers]);

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return (
    <div className="billing-page customers-page">
      <div className="customers-header">
        <h3>Customers</h3>
        <div className="customers-search">
          <input
            className="form-control form-control-sm billing-input"
            placeholder="Search by name, mobile, shop"
            aria-label="Search customers"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button type="button" className="btn btn-outline-primary" onClick={() => navigate('/customers/new')}>
            Add Customer
          </button>
        </div>
      </div>

      {offline && (
        <div className="billing-error" role="status">
          Offline: showing customers saved on this device. Balances may be out of date.
        </div>
      )}
      {error && (
        <div className="billing-error" role="alert">
          {error}{' '}
          <button type="button" className="btn btn-sm btn-outline-light" onClick={() => loadCustomers(search.trim())}>
            Retry
          </button>
        </div>
      )}

      <div className="billing-table-wrapper">
        <table className="billing-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Mobile</th>
              <th>Shop</th>
              <th>Type</th>
              <th>Outstanding</th>
              <th>Credit Limit</th>
              <th>Available Credit</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="9" className="billing-empty">Loading customers...</td>
              </tr>
            )}
            {!loading && !error && customers.length === 0 && (
              <tr>
                <td colSpan="9" className="billing-empty">
                  {search.trim() ? 'No customers match your search.' : 'No customers found.'}
                </td>
              </tr>
            )}
            {!loading && customers.map((customer) => {
              const available = getAvailableCredit(customer);
              return (
                <tr key={customer.id || customer.mobile || customer.phone} className="billing-row">
                  <td>{customer.name || '-'}</td>
                  <td>{customer.mobile || customer.phone || '-'}</td>
                  <td>{customer.shop_name || '-'}</td>
                  <td>{customer.type || '-'}</td>
                  <td className={`customer-balance${isOverCreditLimit(customer) ? ' high' : ''}`}>
                    {formatInr(customer.current_balance)}
                  </td>
                  <td>{formatInr(customer.credit_limit)}</td>
                  <td>{available === null ? '-' : formatInr(available)}</td>
                  <td>{customer.is_active === false ? 'Inactive' : 'Active'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      disabled={!customer.id}
                      onClick={() => navigate(`/customers/${customer.id}`)}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary ms-2"
                      disabled={!customer.id}
                      onClick={() => navigate(`/customers/${customer.id}/edit`)}
                    >
                      Edit
                    </button>
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

export default CustomerList;
