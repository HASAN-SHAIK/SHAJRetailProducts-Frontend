import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/axios';
import { getAllSuppliersCache, updateSuppliersCacheBulk } from '../../core/db';
import { syncAllInventory } from '../../utils/inventorySync';
import './Suppliers.css';

const Suppliers = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const searchTimerRef = useRef(null);

  const fetchSuppliers = async (term = '') => {
    setLoading(true);
    try {
      const cached = await getAllSuppliersCache();
      let localList = Array.isArray(cached) ? cached : [];
      if (term) {
        const needle = term.toLowerCase();
        localList = localList.filter((supplier) => {
          const name = String(supplier.name || '').toLowerCase();
          const mobile = String(supplier.mobile || supplier.phone || '').toLowerCase();
          const gst = String(supplier.gst_number || '').toLowerCase();
          return name.includes(needle) || mobile.includes(needle) || gst.includes(needle);
        });
      }
      setSuppliers(localList);
      if (!navigator.onLine) return;
      const res = await api.get('/suppliers', {
        params: term ? { search: term } : { limit: 500 },
      });
      const list = res?.data?.data?.suppliers || res?.data?.suppliers || [];
      if (Array.isArray(list) && list.length) {
        updateSuppliersCacheBulk(list).catch(() => {});
      }
      setSuppliers(Array.isArray(list) ? list : []);
    } catch {
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers('');
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const term = search.trim();
    searchTimerRef.current = setTimeout(() => {
      fetchSuppliers(term);
    }, 300);
  }, [search]);

  const rows = useMemo(() => suppliers || [], [suppliers]);

  const handleSyncNow = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await syncAllInventory();
      await fetchSuppliers(search.trim());
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="billing-page suppliers-page">
      <div className="customers-header">
        <h3>Suppliers</h3>
        <div className="customers-search">
          <input
            className="form-control form-control-sm billing-input"
            placeholder="Search by name, mobile, GST"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button className="btn btn-outline-secondary" onClick={handleSyncNow} disabled={syncing}>
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
          <button className="btn btn-outline-primary" onClick={() => navigate('/inventory/suppliers/new')}>
            Add Supplier
          </button>
        </div>
      </div>

      <div className="billing-table-wrapper">
        <table className="billing-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Mobile</th>
              <th>GST</th>
              <th>Balance</th>
              <th>Credit Limit</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="7" className="billing-empty">Loading...</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan="7" className="billing-empty">No suppliers found.</td>
              </tr>
            )}
            {!loading && rows.map((supplier) => {
              const balance = Number(supplier.current_balance || 0);
              const limit = Number(supplier.credit_limit || 0);
              const isHigh = limit > 0 && balance > limit;
              return (
                <tr key={supplier.id} className="billing-row">
                  <td>{supplier.name || '-'}</td>
                  <td>{supplier.mobile || '-'}</td>
                  <td>{supplier.gst_number || '-'}</td>
                  <td className={`customer-balance${isHigh ? ' high' : ''}`}>INR {balance.toFixed(2)}</td>
                  <td>INR {limit.toFixed(2)}</td>
                  <td>
                    {(() => {
                      const status = (supplier.sync_status || supplier.syncStatus || 'synced').toLowerCase();
                      if (status === 'pending') return '🟡 Pending';
                      if (status === 'failed') return '🔴 Failed';
                      return '🟢 Synced';
                    })()}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => navigate(`/inventory/suppliers/${supplier.id}`)}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary ms-2"
                      onClick={() => navigate(`/inventory/suppliers/${supplier.id}/edit`)}
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

export default Suppliers;
