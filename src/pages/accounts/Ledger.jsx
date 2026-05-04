import React, { useEffect, useMemo, useState } from 'react';
import api from '../../utils/axios';
import { fetchLedger } from '../../services/accountingService';
import { getAllCustomers, getAllSuppliersCache, updateSuppliersCacheBulk, upsertCustomersBulk } from '../../core/db';
import './Accounts.css';

const formatDateTime = (value) => {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleString();
};

const Ledger = () => {
  const [partyType, setPartyType] = useState('customer');
  const [partyId, setPartyId] = useState('');
  const [parties, setParties] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadParties = async () => {
    try {
      if (partyType === 'customer') {
        const cached = await getAllCustomers();
        setParties(Array.isArray(cached) ? cached : []);
        if (!navigator.onLine) return;
        const res = await api.get('/customers', { params: { limit: 500 } });
        const list = res?.data?.data?.customers || res?.data?.customers || [];
        if (Array.isArray(list) && list.length) {
          upsertCustomersBulk(list).catch(() => {});
        }
        setParties(Array.isArray(list) ? list : cached);
      } else {
        const cached = await getAllSuppliersCache();
        setParties(Array.isArray(cached) ? cached : []);
        if (!navigator.onLine) return;
        const res = await api.get('/suppliers', { params: { limit: 500 } });
        const list = res?.data?.data?.suppliers || res?.data?.suppliers || [];
        if (Array.isArray(list) && list.length) {
          updateSuppliersCacheBulk(list).catch(() => {});
        }
        setParties(Array.isArray(list) ? list : cached);
      }
    } catch {
      setParties([]);
    }
  };

  const loadLedger = async () => {
    if (!partyId) {
      setEntries([]);
      return;
    }
    setLoading(true);
    try {
      const payload = await fetchLedger({ party_type: partyType, party_id: partyId });
      const list = Array.isArray(payload.entries) ? payload.entries : [];
      setEntries(list);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadParties();
  }, [partyType]);

  useEffect(() => {
    loadLedger();
  }, [partyType, partyId]);

  const rows = useMemo(() => entries || [], [entries]);

  return (
    <div className="billing-page accounts-page">
      <div className="customers-header">
        <h3>Ledger</h3>
      </div>
      <div className="billing-filters">
        <select
          className="form-control billing-input"
          value={partyType}
          onChange={(event) => {
            setPartyType(event.target.value);
            setPartyId('');
          }}
        >
          <option value="customer">Customer</option>
          <option value="supplier">Supplier</option>
        </select>
        <select
          className="form-control billing-input"
          value={partyId}
          onChange={(event) => setPartyId(event.target.value)}
        >
          <option value="">Select {partyType}</option>
          {parties.map((party) => (
            <option key={party.id} value={party.id}>
              {party.name || party.supplier_name} {party.mobile ? `(${party.mobile})` : ''}
            </option>
          ))}
        </select>
        <button className="btn btn-outline-secondary" type="button" onClick={loadLedger}>
          Refresh
        </button>
      </div>
      <div className="billing-table-wrapper">
        <table className="billing-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Debit</th>
              <th>Credit</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="5" className="billing-empty">Loading...</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan="5" className="billing-empty">No ledger entries.</td>
              </tr>
            )}
            {!loading && rows.map((entry) => (
              <tr key={entry.id}>
                <td>{formatDateTime(entry.created_at)}</td>
                <td>{entry.txn_type || '-'}</td>
                <td>{entry.debit ? `INR ${Number(entry.debit).toFixed(2)}` : '-'}</td>
                <td>{entry.credit ? `INR ${Number(entry.credit).toFixed(2)}` : '-'}</td>
                <td>INR {Number(entry.balance || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Ledger;
