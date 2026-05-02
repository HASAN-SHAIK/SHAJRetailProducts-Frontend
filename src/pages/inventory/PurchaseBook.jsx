import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/axios';
import { useBranchStore } from '../../store/branchStore';
import { dedupeSuppliersCache, getLocalPurchases, upsertLocalPurchasesBulk, updateSuppliersCacheBulk } from '../../core/db';
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
      const cached = await dedupeSuppliersCache();
      const cachedList = Array.isArray(cached) ? cached : [];
      if (cachedList.length) {
        setSuppliers(cachedList);
      }
      if (!navigator.onLine || cachedList.length) return;
      const res = await api.get('/suppliers', { params: { limit: 500, branch_id: effectiveBranchId } });
      const list = res?.data?.data?.suppliers || res?.data?.suppliers || [];
      if (Array.isArray(list) && list.length) {
        updateSuppliersCacheBulk(list).catch(() => {});
      }
      setSuppliers(Array.isArray(list) ? list : []);
    } catch {
      setSuppliers([]);
    }
  };

  const fetchPurchases = async () => {
    setLoading(true);
    try {
      const supplierCache = await dedupeSuppliersCache();
      const supplierMap = new Map(
        (Array.isArray(supplierCache) ? supplierCache : []).map((item) => [String(item.id), item.name])
      );
      let merged = [];
      const normalizeDateKey = (value) => {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return date.toISOString().slice(0, 10);
      };
      const normalizeTextKey = (value) => String(value || '').trim().toLowerCase();
      const normalizeIdKey = (value) => {
        if (value === null || value === undefined || value === '') return '';
        return String(value).trim();
      };
      const buildFingerprint = (purchase) => {
        const supplierId = String(purchase.supplierId ?? purchase.supplier_id ?? '');
        const invoice = normalizeTextKey(purchase.invoiceNumber ?? purchase.invoice_number ?? '');
        const total = Number(purchase.totalPrice ?? purchase.total_price ?? 0).toFixed(2);
        const dateKey = normalizeDateKey(purchase.date ?? purchase.createdAt ?? purchase.created_at ?? '');
        if (!supplierId || !dateKey) return '';
        if (invoice) return `${supplierId}|${invoice}|${dateKey}`;
        return `${supplierId}|${total}|${dateKey}`;
      };
      const params = {
        branch_id: effectiveBranchId,
        supplier_id: filters.supplier_id || undefined,
        start_date: filters.start_date || undefined,
        end_date: filters.end_date || undefined,
      };

      const deduplicatePurchases = (list) => {
        const choosePreferred = (a, b) => {
          if (!a) return b;
          const score = (entry) => {
            const hasServer = Boolean(normalizeIdKey(entry?.serverId));
            const idLooksServer = /^\d+$/.test(normalizeIdKey(entry?.id));
            const synced = String(entry?.syncStatus || entry?.sync_status || '').toLowerCase() === 'synced';
            const updatedAt = new Date(entry?.updatedAt || entry?.updated_at || entry?.createdAt || entry?.created_at || 0).getTime() || 0;
            return (hasServer ? 40 : 0) + (idLooksServer ? 20 : 0) + (synced ? 10 : 0) + (updatedAt / 1e13);
          };
          return score(b) >= score(a) ? b : a;
        };

        const unique = new Map();
        list.forEach((purchase) => {
          const idKey = normalizeIdKey(purchase?.id);
          const serverId = normalizeIdKey(purchase?.serverId);
          const serverKey = serverId || (/^\d+$/.test(idKey) ? idKey : '');
          const fingerprint = buildFingerprint(purchase);
          const invoiceDateKey = (() => {
            const invoice = normalizeTextKey(purchase?.invoiceNumber ?? purchase?.invoice_number ?? '');
            const dateKey = normalizeDateKey(purchase?.date ?? purchase?.createdAt ?? purchase?.created_at ?? '');
            const supplierId = String(purchase?.supplierId ?? purchase?.supplier_id ?? '').trim();
            const branchId = String(purchase?.branchId ?? purchase?.branch_id ?? '').trim();
            if (!invoice || !dateKey) return '';
            return `${supplierId}|${branchId}|${invoice}|${dateKey}`;
          })();

          const aliasKeys = [
            serverKey ? `server:${serverKey}` : '',
            invoiceDateKey ? `inv:${invoiceDateKey}` : '',
            fingerprint ? `fp:${fingerprint}` : '',
            idKey ? `id:${idKey}` : '',
          ].filter(Boolean);
          if (!aliasKeys.length) return;

          const existing = aliasKeys
            .map((key) => unique.get(key))
            .find(Boolean);
          const winner = choosePreferred(existing, purchase);
          aliasKeys.forEach((key) => unique.set(key, winner));
        });

        const final = Array.from(new Set(Array.from(unique.values())));
        return final;
      };

      const matchesFilters = (purchase) => {
        if (filters.supplier_id && String(purchase.supplierId) !== String(filters.supplier_id)) return false;
        if (filters.start_date) {
          const createdAt = normalizeDateKey(purchase.date || purchase.createdAt || 0);
          if (createdAt < filters.start_date) return false;
        }
        if (filters.end_date) {
          const createdAt = normalizeDateKey(purchase.date || purchase.createdAt || 0);
          if (createdAt > filters.end_date) return false;
        }
        return true;
      };

      const loadFromIndexedDb = async () => {
        try {
          const local = await getLocalPurchases();
          const localList = Array.isArray(local) ? local : [];
          if (!localList.length) return [];
          const unique = deduplicatePurchases(localList);
          return unique.filter(matchesFilters);
        } catch {
          return [];
        }
      };

      const localFiltered = await loadFromIndexedDb();
      if (localFiltered.length) {
        const enriched = localFiltered.map((purchase) => {
          if (purchase.supplierName || purchase.supplier_name) return purchase;
          const resolved = supplierMap.get(String(purchase.supplierId));
          if (!resolved) return purchase;
          return { ...purchase, supplierName: resolved };
        });
        setPurchases(enriched);
        return;
      }

      if (!navigator.onLine) {
        setPurchases([]);
        return;
      }

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
        merged = deduplicatePurchases(mapped);
      }

      const filtered = merged.filter(matchesFilters);
      const enriched = filtered.map((purchase) => {
        if (purchase.supplierName || purchase.supplier_name) return purchase;
        const resolved = supplierMap.get(String(purchase.supplierId));
        if (!resolved) return purchase;
        return { ...purchase, supplierName: resolved };
      });
      setPurchases(enriched);
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
