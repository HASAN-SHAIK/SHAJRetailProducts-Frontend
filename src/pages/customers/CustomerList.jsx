import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllCustomers, searchCustomers, upsertCustomersBulk } from '../../services/local';
import './Customers.css';

const toCustomerIdentity = (customer) => {
  const phone = String(customer?.phone || customer?.mobile || '').replace(/\D/g, '');
  const name = String(customer?.name || '').trim().toLowerCase();
  if (phone && name) return `phone:${phone}|name:${name}`;
  if (phone) return `phone:${phone}`;
  const id = String(customer?.id || '').trim();
  if (id) return `id:${id}`;
  return `name:${name}`;
};

const dedupeCustomers = (list) => {
  const safe = Array.isArray(list) ? list : [];
  const seen = new Set();
  return safe.filter((customer) => {
    const key = toCustomerIdentity(customer);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const CustomerList = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const searchTimerRef = useRef(null);

  const filterLocalCustomers = (list, term) => {
    const needle = String(term || '').trim().toLowerCase();
    if (!needle) return list;
    return list.filter((customer) => {
      const name = String(customer?.name || '').toLowerCase();
      const phone = String(customer?.phone || customer?.mobile || '').toLowerCase();
      const shop = String(customer?.shop_name || '').toLowerCase();
      return name.includes(needle) || phone.includes(needle) || shop.includes(needle);
    });
  };

  const loadCustomersFromCache = async (term = '') => {
    const list = await getAllCustomers();
    const safe = dedupeCustomers(list);
    const filtered = filterLocalCustomers(safe, term);
    setCustomers(filtered);
    return filtered;
  };

  const fetchCustomers = async (term = '') => {
    setLoading(true);
    setError('');
    try {
      const cached = await loadCustomersFromCache(term);
      // Always try the configured repository. In local POS mode it is the on-device
      // SQLite authority and remains available even when navigator.onLine is false.
      const list = await searchCustomers({
        search: term,
        limit: term ? undefined : 500,
      });
      const safe = dedupeCustomers(list);
      setCustomers(safe.length ? safe : cached);
      if (safe.length) {
        upsertCustomersBulk(safe).catch(() => {});
      }
    } catch {
      await loadCustomersFromCache(term).catch(() => setCustomers([]));
      setError('Customer service is unavailable. Showing locally cached customers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers('');
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const term = search.trim();
    searchTimerRef.current = setTimeout(() => {
      fetchCustomers(term);
    }, 300);
  }, [search]);

  const rows = useMemo(() => customers || [], [customers]);

  return (
    <div className="billing-page customers-page">
      <div className="customers-header">
        <h3>Customers</h3>
        <div className="customers-search">
          <input
            className="form-control form-control-sm billing-input"
            placeholder="Search by name or phone"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button className="btn btn-outline-primary" onClick={() => navigate('/customers/new')}>
            Add Customer
          </button>
          <button className="btn btn-outline-secondary" onClick={() => navigate('/customers/reorder')}>
            Reorder
          </button>
        </div>
      </div>

      {error && <div className="billing-message">{error}</div>}

      <div className="billing-table-wrapper">
        <table className="billing-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Type</th>
              <th>Balance</th>
              <th>Credit Limit</th>
              <th>Actions</th>
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
                <td colSpan="6" className="billing-empty">No customers found.</td>
              </tr>
            )}
            {!loading && rows.map((customer) => {
              const balance = Number(customer.current_balance || 0);
              const limit = Number(customer.credit_limit || 0);
              const isHigh = limit > 0 && balance > limit;
              return (
                <tr key={customer.id} className="billing-row">
                  <td>{customer.name || '-'}</td>
                  <td>{customer.phone || customer.mobile || '-'}</td>
                  <td>{customer.type || 'retail'}</td>
                  <td className={`customer-balance${isHigh ? ' high' : ''}`}>INR {balance.toFixed(2)}</td>
                  <td>INR {limit.toFixed(2)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => navigate(`/customers/${customer.id}`)}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary ms-2"
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
