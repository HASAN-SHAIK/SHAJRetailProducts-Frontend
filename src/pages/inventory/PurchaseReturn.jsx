import React, { useEffect, useMemo, useState } from 'react';
import api from '../../utils/axios';
import { usePopup } from '../../components/common/PopUp/PopupProvider';
import { useBranchStore } from '../../store/branchStore';
import {
  addLocalPurchaseItems,
  dedupeSuppliersCache,
  getLocalPurchaseById,
  getLocalPurchaseItems,
  getLocalPurchaseReturns,
  getLocalPurchases,
  upsertLocalPurchasesBulk
} from '../../core/db';
import { enqueueOfflinePurchaseReturn } from '../../utils/offlinePurchaseReturns';
import { processInventorySyncQueue } from '../../utils/inventorySync';
import './Suppliers.css';

const PurchaseReturn = () => {
  const { showPopup } = usePopup();
  const selectedBranchId = useBranchStore((state) => state.selectedBranchId);
  const effectiveBranchId = selectedBranchId && selectedBranchId !== 'all' ? selectedBranchId : null;

  const [purchases, setPurchases] = useState([]);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState('');
  const [detail, setDetail] = useState(null);
  const [returnRows, setReturnRows] = useState([]);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  const resolveServerPurchaseId = (value) => {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    if (!text) return null;
    if (text.startsWith('temp_') || text.startsWith('temp:') || text.startsWith('local:')) return null;
    const numeric = Number(text);
    return Number.isFinite(numeric) ? String(numeric) : null;
  };

  const fetchPurchases = async () => {
    try {
      const supplierCache = await dedupeSuppliersCache();
      const supplierMap = new Map(
        (Array.isArray(supplierCache) ? supplierCache : []).map((item) => [String(item.id), item.name])
      );
      const local = await getLocalPurchases();
      const localList = Array.isArray(local) ? local : [];
      if (localList.length) {
        const enrichedLocal = localList.map((purchase) => {
          if (purchase.supplierName || purchase.supplier_name) return purchase;
          const resolved = supplierMap.get(String(purchase.supplierId));
          if (!resolved) return purchase;
          return { ...purchase, supplierName: resolved };
        });
        setPurchases(enrichedLocal);
        if (!navigator.onLine) return;
      } else if (!navigator.onLine) {
        setPurchases([]);
        return;
      }
      const res = await api.get('/purchases', { params: { branch_id: effectiveBranchId, limit: 200 } });
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
      }
      const localMap = new Map(localList.map((item) => [item.serverId || item.id, item]));
      (Array.isArray(list) ? list : []).forEach((serverItem) => {
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
      const merged = Array.from(localMap.values());
      const enriched = merged.map((purchase) => {
        if (purchase.supplierName || purchase.supplier_name) return purchase;
        const resolved = supplierMap.get(String(purchase.supplierId));
        if (!resolved) return purchase;
        return { ...purchase, supplierName: resolved };
      });
      setPurchases(enriched);
    } catch {
      setPurchases([]);
    }
  };

  const fetchDetail = async (purchaseId) => {
    if (!purchaseId) {
      setDetail(null);
      setReturnRows([]);
      return;
    }
    try {
      const local = await getLocalPurchaseById(purchaseId);
      const items = await getLocalPurchaseItems(purchaseId);
      if (local) {
        const resolvedId = local.serverId || local.id;
        setDetail({
          order: {
            id: resolvedId,
            supplier_id: local.supplierId ?? null,
            supplier_name: local.supplierName ?? null,
            branch_id: local.branchId ?? null,
            invoice_number: local.invoiceNumber ?? null,
            total_price: local.totalPrice ?? null,
          },
          items: items.map((item) => ({
            id: item.id,
            product_id: item.productId,
            product_name: item.name ?? item.product_name ?? null,
          })),
          batches: [],
        });
        const rows = items.map((item) => ({
          batch_id: item.id,
          product_id: item.productId,
          batch_number: item.batch_number ?? 'LOCAL',
          expiry_date: item.expiry_date ?? null,
          available: item.quantity ?? 0,
          return_qty: '',
        }));
        setReturnRows(rows);
        const serverPurchaseId = resolveServerPurchaseId(local.serverId || purchaseId);
        if (!navigator.onLine || !serverPurchaseId) return;
        purchaseId = serverPurchaseId;
      } else if (!navigator.onLine) {
        setDetail(null);
        setReturnRows([]);
        return;
      } else {
        const serverPurchaseId = resolveServerPurchaseId(purchaseId);
        if (!serverPurchaseId) {
          setDetail(null);
          setReturnRows([]);
          return;
        }
        purchaseId = serverPurchaseId;
      }

      const res = await api.get(`/purchases/${purchaseId}`);
      const data = res?.data?.data || null;
      setDetail(data);
      if (data?.order) {
        const order = data.order;
        const localPurchase = {
          id: String(order.id),
          supplierId: order.supplier_id ?? null,
          supplierName: order.supplier_name ?? null,
          invoiceNumber: order.invoice_number ?? null,
          paymentMode: order.payment_mode ?? null,
          totalPrice: order.total_price ?? null,
          branchId: order.branch_id ?? null,
          createdAt: order.created_at ?? null,
          date: order.created_at ?? null,
          syncStatus: 'synced',
          sync_status: 'synced',
          serverId: order.id ?? null,
        };
        await upsertLocalPurchasesBulk([localPurchase]).catch(() => {});
      }
      if (Array.isArray(data?.items) && data.items.length > 0 && data?.order?.id) {
        const purchaseIdValue = String(data.order.id);
        const mappedItems = data.items.map((item, idx) => ({
          id: item.id ?? `item_${purchaseIdValue}_${idx + 1}`,
          purchaseId: purchaseIdValue,
          productId: item.product_id ?? item.productId ?? null,
          name: item.product_name ?? item.name ?? null,
          barcode: item.barcode ?? null,
          category: item.category ?? null,
          company: item.company ?? null,
          mrp: item.mrp ?? null,
          quantity: item.quantity ?? 0,
          purchase_price: item.purchase_price_snapshot ?? item.purchase_price ?? null,
          selling_price: item.selling_price ?? null,
          gst_percent: item.gst_percent ?? null,
          expiry_date: item.expiry_date ?? null,
        }));
        await addLocalPurchaseItems(mappedItems).catch(() => {});
      }
      const rows = (data?.batches || []).map((batch) => ({
        batch_id: batch.id,
        product_id: batch.product_id,
        batch_number: batch.batch_number,
        expiry_date: batch.expiry_date,
        available: batch.quantity_remaining ?? batch.quantity ?? 0,
        return_qty: '',
      }));
      setReturnRows(rows);
    } catch {
      // ignore fetch errors; local data already handled above
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, [effectiveBranchId]);

  useEffect(() => {
    fetchDetail(selectedPurchaseId);
  }, [selectedPurchaseId]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const refreshPending = async () => {
      const pending = await getLocalPurchaseReturns('pending');
      setPendingSyncCount(Array.isArray(pending) ? pending.length : 0);
    };
    refreshPending();
    const handler = () => refreshPending();
    window.addEventListener('offline-purchase-return-updated', handler);
    return () => window.removeEventListener('offline-purchase-return-updated', handler);
  }, []);

  const itemsByProductId = useMemo(() => {
    const map = new Map();
    (detail?.items || []).forEach((item) => {
      map.set(item.product_id, item.product_name || String(item.product_id));
    });
    return map;
  }, [detail]);

  const updateRow = (index, value) => {
    setReturnRows((prev) => prev.map((row, idx) => (idx === index ? { ...row, return_qty: value } : row)));
  };

  const handleSubmit = async () => {
    if (!detail?.order) {
      showPopup('Select a purchase first.', 'Validation');
      return;
    }
    const items = returnRows
      .filter((row) => Number(row.return_qty || 0) > 0)
      .map((row) => ({
        batch_id: row.batch_id,
        product_id: row.product_id,
        quantity: Number(row.return_qty || 0),
      }));

    if (!items.length) {
      showPopup('Enter at least one return quantity.', 'Validation');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        purchase_id: detail.order.id,
        supplier_id: detail.order.supplier_id,
        branch_id: detail.order.branch_id || effectiveBranchId,
        items,
        reason,
      };
      await enqueueOfflinePurchaseReturn(payload);
      showPopup('Return saved offline. Will sync in background.', 'Offline');
      setSelectedPurchaseId('');
      setDetail(null);
      setReturnRows([]);
      setReason('');
      if (navigator.onLine) {
        processInventorySyncQueue().catch(() => {});
      }
      fetchPurchases();
    } catch (err) {
      showPopup(err?.response?.data?.message || 'Failed to save return', 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="billing-page suppliers-page">
      <div className="customers-header d-flex align-items-center gap-2">
        <h3>Purchase Return</h3>
        {isOffline && <span className="badge bg-warning text-dark">Offline Mode</span>}
        {pendingSyncCount > 0 && (
          <span className="badge bg-info text-dark">Pending Sync: {pendingSyncCount}</span>
        )}
      </div>

      <div className="billing-filters">
        <select
          className="form-control billing-input"
          value={selectedPurchaseId}
          onChange={(event) => setSelectedPurchaseId(event.target.value)}
        >
          <option value="">Select Purchase</option>
          {purchases.map((purchase) => (
            <option key={purchase.serverId || purchase.id} value={purchase.serverId || purchase.id}>
              #{purchase.serverId || purchase.id} - {purchase.supplierName || purchase.supplier_name || 'Supplier'} - INR {Number(purchase.totalPrice || purchase.total_price || 0).toFixed(2)}
            </option>
          ))}
        </select>
        <input
          className="form-control billing-input"
          placeholder="Return Reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>

      {detail?.order && (
        <div className="customer-card customer-detail-grid">
          <div>
            <div className="customer-card__label">Supplier</div>
            <div>{detail.order.supplier_name || '-'}</div>
          </div>
          <div>
            <div className="customer-card__label">Invoice</div>
            <div>{detail.order.invoice_number || '-'}</div>
          </div>
          <div>
            <div className="customer-card__label">Amount</div>
            <div>INR {Number(detail.order.total_price || 0).toFixed(2)}</div>
          </div>
        </div>
      )}

      <div className="billing-table-wrapper">
        <table className="billing-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Batch</th>
              <th>Expiry</th>
              <th>Available</th>
              <th>Return Qty</th>
            </tr>
          </thead>
          <tbody>
            {detail?.order && returnRows.length === 0 && (
              <tr>
                <td colSpan="5" className="billing-empty">No batches available.</td>
              </tr>
            )}
            {returnRows.map((row, idx) => (
              <tr key={row.batch_id}>
                <td>{itemsByProductId.get(row.product_id) || row.product_id}</td>
                <td>{row.batch_number || '-'}</td>
                <td>{row.expiry_date ? new Date(row.expiry_date).toLocaleDateString() : '-'}</td>
                <td>{row.available}</td>
                <td>
                  <input
                    className="form-control billing-input"
                    type="number"
                    min="0"
                    max={row.available}
                    value={row.return_qty}
                    onChange={(event) => updateRow(idx, event.target.value)}
                  />
                </td>
              </tr>
            ))}
            {!detail?.order && (
              <tr>
                <td colSpan="5" className="billing-empty">Select a purchase to load batches.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="billing-modal-actions">
        <button className="btn btn-success" type="button" onClick={handleSubmit} disabled={saving || !detail?.order}>
          {saving ? 'Saving...' : 'Save Return'}
        </button>
      </div>
    </div>
  );
};

export default PurchaseReturn;
