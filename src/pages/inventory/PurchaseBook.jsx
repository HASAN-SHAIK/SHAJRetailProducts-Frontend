import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/axios';
import { useBranchStore } from '../../store/branchStore';
import { getAllSuppliersCache, getLocalPurchases, upsertLocalPurchasesBulk } from '../../core/db';
import { syncAllInventory } from '../../utils/inventorySync';
import './Suppliers.css';

const PurchaseBook = () => {
  const navigate = useNavigate();
  const selectedBranchId = useBranchStore((state) => state.selectedBranchId);
  const effectiveBranchId = selectedBranchId && selectedBranchId !== 'all' ? selectedBranchId : null;

  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [filters, setFilters] = useState({ supplier_id: '', start_date: '', end_date: '' });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const fetchSuppliers = async () => {
    try {
      if (!navigator.onLine) {
        const cached = await getAllSuppliersCache();
        setSuppliers(Array.isArray(cached) ? cached : []);
        return;
      }
      const res = await api.get('/suppliers', { params: { limit: 500, branch_id: effectiveBranchId } });
      setSuppliers(res?.data?.data?.suppliers || res?.data?.suppliers || []);
    } catch {
      setSuppliers([]);
    }
  };

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const local = await getLocalPurchases();
      let merged = Array.isArray(local) ? local : [];
      const params = {
        branch_id: effectiveBranchId,
        supplier_id: filters.supplier_id || undefined,
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined,
      };
      if (navigator.onLine) {
        const res = await api.get('/purchases', { params });
        const list = res?.data?.data?.purchases || res?.data?.purchases || [];
        if (Array.isArray(list) && list.length) {
          const mapped = list.map((purchase) => ({
            id: String(purchase.id),
            supplierId: purchase.supplier_id ?? null,
            supplierName: purchase.supplier_name ?? null,
            invoiceNumber: purchase.invoice_number ?? null,
            paymentMode: purchase.payment_mode ?? null,
            totalPrice: purchase.total_price ?? null,
            branchId: purchase.branch_id ?? null,
            createdAt: purchase.created_at ?? null,
            date: purchase.created_at ?? null,
            syncStatus: 'synced',
            sync_status: 'synced',
            serverId: purchase.id ?? null,
          }));
          await upsertLocalPurchasesBulk(mapped).catch(() => {});
          const localMap = new Map(
            merged.map((item) => [item.serverId || item.id, item])
          );
          list.forEach((serverItem) => {
            const key = serverItem.id;
            if (!localMap.has(key)) {
              localMap.set(key, {
                id: String(serverItem.id),
                supplierId: serverItem.supplier_id ?? null,
                supplierName: serverItem.supplier_name ?? null,
                invoiceNumber: serverItem.invoice_number ?? null,
                paymentMode: serverItem.payment_mode ?? null,
                totalPrice: serverItem.total_price ?? null,
                branchId: serverItem.branch_id ?? null,
                createdAt: serverItem.created_at ?? null,
                date: serverItem.created_at ?? null,
                syncStatus: 'synced',
                sync_status: 'synced',
                serverId: serverItem.id ?? null,
              });
            }
          });
          merged = Array.from(localMap.values());
        }
      }
      const filtered = merged.filter((purchase) => {
        if (filters.supplier_id && String(purchase.supplierId) !== String(filters.supplier_id)) return false;
        if (filters.start_date) {
          const createdAt = new Date(purchase.date || purchase.createdAt || 0).toISOString().slice(0, 10);
          if (createdAt < filters.start_date) return false;
        }
        if (filters.end_date) {
          const createdAt = new Date(purchase.date || purchase.createdAt || 0).toISOString().slice(0, 10);
          if (createdAt > filters.end_date) return false;
        }
        return true;
      });
      setPurchases(filtered);
    } catch {
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [effectiveBranchId]);

  useEffect(() => {
    fetchPurchases();
  }, [effectiveBranchId, filters]);

  const handleSyncNow = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await syncAllInventory();
      await fetchPurchases();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="billing-page suppliers-page">
      <div className="customers-header">
        <h3>Purchase Book</h3>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary" onClick={handleSyncNow} disabled={syncing}>
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
          <button className="btn btn-outline-primary" onClick={() => navigate('/inventory/purchase')}>
            New Purchase
          </button>
        </div>
      </div>

      <div className="billing-filters">
        <select
          className="form-control billing-input"
          value={filters.supplier_id}
          onChange={(event) => setFilters((prev) => ({ ...prev, supplier_id: event.target.value }))}
        >
          <option value="">All Suppliers</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
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
      </div>

      <div className="billing-table-wrapper">
        <table className="billing-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Invoice</th>
              <th>Supplier</th>
              <th>Amount</th>
              <th>Payment Mode</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="7" className="billing-empty">Loading...</td>
              </tr>
            )}
            {!loading && purchases.length === 0 && (
              <tr>
                <td colSpan="7" className="billing-empty">No purchases found.</td>
              </tr>
            )}
            {!loading && purchases.map((purchase) => (
              <tr key={purchase.id}>
                <td>{purchase.createdAt || purchase.created_at ? new Date(purchase.createdAt || purchase.created_at).toLocaleDateString() : '-'}</td>
                <td>{purchase.invoiceNumber || purchase.invoice_number || '-'}</td>
                <td>{purchase.supplierName || purchase.supplier_name || '-'}</td>
                <td>INR {Number(purchase.totalPrice || purchase.total_price || 0).toFixed(2)}</td>
                <td>{purchase.paymentMode || purchase.payment_mode || '-'}</td>
                <td>
                  {(() => {
                    const status = (purchase.syncStatus || purchase.sync_status || 'synced').toLowerCase();
                    if (status === 'pending') return '🟡 Pending';
                    if (status === 'failed') return '🔴 Failed';
                    return '🟢 Synced';
                  })()}
                </td>
                <td>
                  <button
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => navigate(`/inventory/purchases/${purchase.serverId || purchase.id}`)}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PurchaseBook;
