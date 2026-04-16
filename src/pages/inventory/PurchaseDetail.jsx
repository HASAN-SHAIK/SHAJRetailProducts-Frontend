import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../utils/axios';
import { addLocalPurchaseItems, getLocalPurchaseById, getLocalPurchaseItems, upsertLocalPurchasesBulk } from '../../core/db';
import './Suppliers.css';

const PurchaseDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  const resolveServerPurchaseId = (value) => {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    if (!text) return null;
    if (text.startsWith('temp_') || text.startsWith('temp:') || text.startsWith('local:')) return null;
    const numeric = Number(text);
    return Number.isFinite(numeric) ? String(numeric) : null;
  };

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const local = await getLocalPurchaseById(id);
      let serverData = null;
      if (local) {
        const resolvedId = local.serverId || local.id;
        const items = await getLocalPurchaseItems(id);
        setDetail({
          order: {
            id: resolvedId,
            supplier_name: local.supplierName || '-',
            supplier_id: local.supplierId ?? null,
            invoice_number: local.invoiceNumber ?? null,
            total_price: local.totalPrice ?? null,
            payment_mode: local.paymentMode ?? null,
          },
          items: items.map((item) => ({
            id: item.id,
            product_name: item.name ?? '-',
            batch_number: item.batch_number ?? null,
            quantity: item.quantity ?? 0,
            purchase_price_snapshot: item.purchase_price ?? 0,
            selling_price: item.selling_price ?? 0,
            gst_percent: item.gst_percent ?? 0,
          })),
          batches: [],
        });
        const serverPurchaseId = resolveServerPurchaseId(local.serverId || id);
        if (navigator.onLine && serverPurchaseId) {
          const res = await api.get(`/purchases/${serverPurchaseId}`);
          serverData = res?.data?.data || null;
          setDetail(serverData);
        }
      } else if (!navigator.onLine) {
        setDetail(null);
        return;
      } else {
        const serverPurchaseId = resolveServerPurchaseId(id);
        if (!serverPurchaseId) {
          setDetail(null);
          return;
        }
        const res = await api.get(`/purchases/${serverPurchaseId}`);
        serverData = res?.data?.data || null;
        setDetail(serverData);
      }
      const data = serverData;
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
          id: item.id ?? `temp_item_${purchaseIdValue}_${idx + 1}`,
          purchaseId: purchaseIdValue,
          productId: item.product_id ?? item.productId ?? null,
          batch_number: item.batch_number ?? null,
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
    } catch {
      // ignore fetch errors; local data already handled above
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const items = useMemo(() => detail?.items || [], [detail]);
  const batches = useMemo(() => detail?.batches || [], [detail]);

  if (loading) {
    return (
      <div className="billing-page suppliers-page">
        <div className="billing-empty">Loading...</div>
      </div>
    );
  }

  if (!detail?.order) {
    return (
      <div className="billing-page suppliers-page">
        <div className="billing-empty">Purchase not found.</div>
      </div>
    );
  }

  const { order } = detail;

  return (
    <div className="billing-page suppliers-page">
      <div className="customers-header">
        <h3>Purchase #{order.id}</h3>
        <button className="btn btn-outline-light" onClick={() => navigate('/inventory/purchases')}>
          Back
        </button>
      </div>

      <div className="customer-card customer-detail-grid">
        <div>
          <div className="customer-card__label">Supplier</div>
          <div>{order.supplier_name || '-'}</div>
        </div>
        <div>
          <div className="customer-card__label">Invoice</div>
          <div>{order.invoice_number || '-'}</div>
        </div>
        <div>
          <div className="customer-card__label">Amount</div>
          <div>INR {Number(order.total_price || 0).toFixed(2)}</div>
        </div>
        <div>
          <div className="customer-card__label">Payment Mode</div>
          <div>{order.payment_mode || '-'}</div>
        </div>
      </div>

      <div className="billing-table-wrapper">
        <h5 className="section-title">Items</h5>
        <table className="billing-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Batch</th>
              <th>Qty</th>
              <th>Purchase Price</th>
              <th>Selling Price</th>
              <th>GST %</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan="6" className="billing-empty">No items.</td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.product_name || '-'}</td>
                <td>{item.batch_number || '-'}</td>
                <td>{item.quantity}</td>
                <td>INR {Number(item.purchase_price_snapshot || 0).toFixed(2)}</td>
                <td>INR {Number(item.selling_price || 0).toFixed(2)}</td>
                <td>{item.gst_percent ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="billing-table-wrapper">
        <h5 className="section-title">Batches</h5>
        <table className="billing-table">
          <thead>
            <tr>
              <th>Batch</th>
              <th>Product ID</th>
              <th>MRP</th>
              <th>Purchase Price</th>
              <th>Selling Price</th>
              <th>Expiry</th>
              <th>Qty</th>
              <th>Remaining</th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 && (
              <tr>
                <td colSpan="8" className="billing-empty">No batches.</td>
              </tr>
            )}
            {batches.map((batch) => (
              <tr key={batch.id}>
                <td>{batch.batch_number || '-'}</td>
                <td>{batch.product_id}</td>
                <td>{batch.mrp !== null && batch.mrp !== undefined ? Number(batch.mrp).toFixed(2) : '-'}</td>
                <td>{batch.purchase_price !== null && batch.purchase_price !== undefined ? Number(batch.purchase_price).toFixed(2) : '-'}</td>
                <td>{batch.selling_price !== null && batch.selling_price !== undefined ? Number(batch.selling_price).toFixed(2) : '-'}</td>
                <td>{batch.expiry_date ? new Date(batch.expiry_date).toLocaleDateString() : '-'}</td>
                <td>{batch.quantity}</td>
                <td>{batch.quantity_remaining ?? batch.quantity ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PurchaseDetail;
