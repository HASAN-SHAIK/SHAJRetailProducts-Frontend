import React, { useEffect, useState } from 'react';
import api from '../../utils/axios';
import { fetchOutstanding } from '../../services/accountingService';
import { getAllCustomers, getAllSuppliersCache, upsertCustomersBulk, updateSuppliersCacheBulk } from '../../core/db';
import './Accounts.css';

const Outstanding = () => {
  const [tab, setTab] = useState('customers');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadOffline = async () => {
    if (tab === 'customers') {
      const cached = await getAllCustomers();
      return (Array.isArray(cached) ? cached : []).map((customer) => {
        const outstanding = Number(customer.current_balance || 0);
        return {
          party_id: customer.id,
          party_name: customer.name || '-',
          total_debit: outstanding,
          total_credit: 0,
          outstanding,
        };
      });
    }
    const cached = await getAllSuppliersCache();
    return (Array.isArray(cached) ? cached : []).map((supplier) => {
      const outstanding = Number(supplier.current_balance || 0);
      return {
        party_id: supplier.id,
        party_name: supplier.name || '-',
        total_debit: 0,
        total_credit: outstanding,
        outstanding,
      };
    });
  };

  const loadOnline = async () => {
    const payload = await fetchOutstanding({ party_type: tab === 'customers' ? 'customer' : 'supplier' });
    return Array.isArray(payload.rows) ? payload.rows : [];
  };

  const hydrateCaches = async () => {
    if (!navigator.onLine) return;
    if (tab === 'customers') {
      const res = await api.get('/customers', { params: { limit: 500 } });
      const list = res?.data?.data?.customers || res?.data?.customers || [];
      if (Array.isArray(list) && list.length) {
        upsertCustomersBulk(list).catch(() => {});
      }
    } else {
      const res = await api.get('/suppliers', { params: { limit: 500 } });
      const list = res?.data?.data?.suppliers || res?.data?.suppliers || [];
      if (Array.isArray(list) && list.length) {
        updateSuppliersCacheBulk(list).catch(() => {});
      }
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const data = navigator.onLine ? await loadOnline() : await loadOffline();
      setRows(data);
      hydrateCaches().catch(() => {});
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [tab]);

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
        <button className="btn btn-outline-secondary" type="button" onClick={load}>
          Refresh
        </button>
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
                <td colSpan="4" className="billing-empty">No data.</td>
              </tr>
            )}
            {!loading && rows.map((row) => {
              const outstanding = Number(row.outstanding || 0);
              return (
                <tr key={row.party_id}>
                  <td>{row.party_name || '-'}</td>
                  <td>INR {Number(row.total_debit || 0).toFixed(2)}</td>
                  <td>INR {Number(row.total_credit || 0).toFixed(2)}</td>
                  <td className={outstanding > 0 ? 'text-success' : outstanding < 0 ? 'text-danger' : ''}>
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
