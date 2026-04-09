import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../utils/axios';
import { getLocalPurchaseById, getLocalPurchaseItems } from '../../core/db';
import './Suppliers.css';

const PurchaseDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      if (!navigator.onLine) throw new Error('offline');
      const res = await api.get(`/purchases/${id}`);
      setDetail(res?.data?.data || null);
    } catch {
      const local = await getLocalPurchaseById(id);
      if (local) {
        const items = await getLocalPurchaseItems(id);
        setDetail({
          order: {
            id: local.serverId || local.id,
            supplier_name: local.supplierName || '-',
            supplier_id: local.supplierId ?? null,
            invoice_number: local.invoiceNumber ?? null,
            total_price: local.totalPrice ?? null,
            payment_mode: local.paymentMode ?? null,
          },
          items: items.map((item) => ({
            id: item.id,
            product_name: item.name ?? '-',
            quantity: item.quantity ?? 0,
            purchase_price_snapshot: item.purchase_price ?? 0,
            selling_price: item.selling_price ?? 0,
            gst_percent: item.gst_percent ?? 0,
          })),
          batches: [],
        });
      } else {
        setDetail(null);
      }
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
              <th>Qty</th>
              <th>Purchase Price</th>
              <th>Selling Price</th>
              <th>GST %</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan="5" className="billing-empty">No items.</td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.product_name || '-'}</td>
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
              <th>Expiry</th>
              <th>Qty</th>
              <th>Remaining</th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 && (
              <tr>
                <td colSpan="5" className="billing-empty">No batches.</td>
              </tr>
            )}
            {batches.map((batch) => (
              <tr key={batch.id}>
                <td>{batch.batch_number || '-'}</td>
                <td>{batch.product_id}</td>
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
