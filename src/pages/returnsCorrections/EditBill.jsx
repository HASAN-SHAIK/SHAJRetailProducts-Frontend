import React, { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { usePopup } from '../../components/common/PopUp/PopupProvider';
import ReturnsHeader from '../../components/returnsCorrections/ReturnsHeader';
import { db, getCustomerById, upsertLocalCorrection, upsertLocalGstEntry } from '../../core/db';
import { createCorrection, fetchAllSalesOrders, fetchOrderDetails } from '../../services/returnsCorrectionsApi';
import './ReturnsCorrections.css';

const EditBill = () => {
  const { showPopup } = usePopup();
  const [orders, setOrders] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [billDetails, setBillDetails] = useState(null);
  const [billDetailsLoading, setBillDetailsLoading] = useState(false);
  const [billDetailsError, setBillDetailsError] = useState('');
  const [fallbackCustomer, setFallbackCustomer] = useState(null);
  const [form, setForm] = useState({
    billId: '',
    type: 'EDIT',
    changes: '',
    adjustedAmount: '',
    taxAdjustment: '',
  });
  const selectedOrder = orders.find((order) => String(order?.id) === String(form.billId));
  const resolvedCustomerName =
    billDetails?.customer?.name ||
    billDetails?.customer_name ||
    billDetails?.customerName ||
    billDetails?.customer?.customer_name ||
    selectedOrder?.customer?.name ||
    selectedOrder?.customer_name ||
    selectedOrder?.customerName ||
    fallbackCustomer?.name ||
    '-';
  const resolvedCustomerPhone =
    billDetails?.customer?.mobile ||
    billDetails?.customer?.phone ||
    billDetails?.customer_phone ||
    billDetails?.customer_mobile ||
    billDetails?.customerPhone ||
    selectedOrder?.customer?.mobile ||
    selectedOrder?.customer?.phone ||
    selectedOrder?.customer_phone ||
    selectedOrder?.customer_mobile ||
    selectedOrder?.customerPhone ||
    fallbackCustomer?.mobile ||
    fallbackCustomer?.phone ||
    '-';
  const getBillOptionLabel = (order) => {
    const status = String(order?.order_status || '').toLowerCase();
    const returnedAmount = Number(order?.returned_amount || 0);
    const totalAmount = Number(order?.total_amount || order?.total_price || 0);
    const isFullyReturned = status === 'returned' || (totalAmount > 0 && returnedAmount >= totalAmount);
    const isPartiallyReturned =
      status === 'partially_returned' || (!isFullyReturned && returnedAmount > 0);
    if (isFullyReturned) return `Bill #${order.id} (Returned)`;
    if (isPartiallyReturned) return `Bill #${order.id} (Partially Returned)`;
    return `Bill #${order.id}`;
  };

  const loadOrders = useCallback(async () => {
    if (navigator.onLine) {
      try {
        const list = await fetchAllSalesOrders();
        setOrders(list);
        return;
      } catch {
        // fallback to local
      }
    }
    const list = await db.orders.toArray();
    setOrders(list);
  }, []);

  const loadBillDetails = useCallback(async (billId) => {
    if (!billId) {
      setBillDetails(null);
      setBillDetailsError('');
      return;
    }
    setBillDetailsLoading(true);
    setBillDetailsError('');
    try {
      if (navigator.onLine) {
        const detail = await fetchOrderDetails(billId);
        setBillDetails(detail || null);
        return;
      }
      const cachedOrder = await db.orders.get(Number(billId)).catch(() => null);
      const cachedByText = cachedOrder || (await db.orders.get(String(billId)).catch(() => null));
      const itemListByText = await db.order_items.where('order_id').equals(String(billId)).toArray();
      const itemListByNumber = Number.isFinite(Number(billId))
        ? await db.order_items.where('order_id').equals(Number(billId)).toArray()
        : [];
      setBillDetails({
        ...(cachedByText || { id: billId }),
        items: itemListByText.length ? itemListByText : itemListByNumber,
      });
    } catch {
      setBillDetails(null);
      setBillDetailsError('Unable to load bill details.');
    } finally {
      setBillDetailsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    loadBillDetails(form.billId);
  }, [form.billId, loadBillDetails]);

  useEffect(() => {
    const loadFallbackCustomer = async () => {
      setFallbackCustomer(null);
      const customerId = billDetails?.customer_id || selectedOrder?.customer_id || selectedOrder?.customerId;
      if (!customerId) return;
      const customer = await getCustomerById(customerId).catch(() => null);
      setFallbackCustomer(customer || null);
    };
    loadFallbackCustomer();
  }, [billDetails?.customer_id, selectedOrder?.customer_id, selectedOrder?.customerId]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.billId) {
      showPopup('Select a bill', 'Validation');
      return;
    }

    const correctionId = uuidv4();
    let changes = null;
    try {
      changes = form.changes ? JSON.parse(form.changes) : null;
    } catch {
      showPopup('Changes must be valid JSON', 'Validation');
      return;
    }

    const adjustedAmount = Number(form.adjustedAmount || 0);
    const taxAdjustment = Number(form.taxAdjustment || 0);
    const payload = {
      correctionId,
      billId: form.billId,
      type: form.type,
      changes,
      adjustedAmount,
      taxAdjustment,
      createdAt: new Date().toISOString(),
      isSynced: false,
      syncAction: 'CREATE',
    };

    if (navigator.onLine) {
      setSubmitting(true);
      try {
        await createCorrection(payload);
        showPopup('Correction saved successfully', 'Success');
        setForm((prev) => ({ ...prev, changes: '', adjustedAmount: '', taxAdjustment: '' }));
        return;
      } catch {
        // fallback to offline mode
      } finally {
        setSubmitting(false);
      }
    }

    await upsertLocalCorrection(payload);
    if (taxAdjustment !== 0) {
      await upsertLocalGstEntry({
        gstEntryId: uuidv4(),
        billId: form.billId,
        type: 'ADJUSTMENT',
        taxableAmount: adjustedAmount,
        cgst: taxAdjustment / 2,
        sgst: taxAdjustment / 2,
        igst: 0,
        totalTax: taxAdjustment,
        date: new Date().toISOString().slice(0, 10),
        isSynced: false,
        syncAction: 'CREATE',
        updatedAt: new Date().toISOString(),
      });
    }
    showPopup('Correction saved successfully.', 'Success');
    setForm((prev) => ({ ...prev, changes: '', adjustedAmount: '', taxAdjustment: '' }));
  };

  return (
    <div className="returns-page">
      <ReturnsHeader title="Edit Bill" />
      <div className="returns-card">
        <form className="returns-form" onSubmit={handleSubmit}>
          <div className="row g-2">
            <div className="col-md-4">
              <label className="form-label">Bill</label>
              <select className="form-select" name="billId" value={form.billId} onChange={handleChange}>
                <option value="">Select bill</option>
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {getBillOptionLabel(order)}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Type</label>
              <select className="form-select" name="type" value={form.type} onChange={handleChange}>
                <option value="EDIT">Edit</option>
                <option value="UPDATE">Update</option>
                <option value="CANCEL">Cancel</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Adjusted Amount</label>
              <input className="form-control" name="adjustedAmount" value={form.adjustedAmount} onChange={handleChange} />
            </div>
          </div>
          <div className="row g-2">
            <div className="col-md-4">
              <label className="form-label">Tax Adjustment</label>
              <input className="form-control" name="taxAdjustment" value={form.taxAdjustment} onChange={handleChange} />
            </div>
            <div className="col-md-8">
              <label className="form-label">Changes (JSON diff)</label>
              <textarea className="form-control" rows={3} name="changes" value={form.changes} onChange={handleChange} />
            </div>
          </div>
          <div className="returns-actions">
            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Correction'}
            </button>
          </div>
        </form>
      </div>

      <div className="returns-card">
        <h4>Selected Bill Details</h4>
        {!form.billId && <div className="text-secondary">Select a bill to view details.</div>}
        {form.billId && billDetailsLoading && <div className="text-secondary">Loading bill details...</div>}
        {form.billId && !billDetailsLoading && billDetailsError && (
          <div className="text-secondary">{billDetailsError}</div>
        )}
        {form.billId && !billDetailsLoading && !billDetailsError && billDetails && (
          <>
            <div className="row g-2 mb-2">
              <div className="col-md-3"><strong>Bill:</strong> #{billDetails.id || form.billId}</div>
              <div className="col-md-3"><strong>Status:</strong> {billDetails.order_status || '-'}</div>
              <div className="col-md-3"><strong>Total:</strong> {Number(billDetails.total_amount || billDetails.total_price || 0).toFixed(2)}</div>
              <div className="col-md-3"><strong>Returned:</strong> {Number(billDetails.returned_amount || 0).toFixed(2)}</div>
            </div>
            <div className="row g-2 mb-3">
              <div className="col-md-4"><strong>Customer:</strong> {resolvedCustomerName}</div>
              <div className="col-md-4"><strong>Phone:</strong> {resolvedCustomerPhone}</div>
              <div className="col-md-4"><strong>Date:</strong> {billDetails.created_at ? new Date(billDetails.created_at).toLocaleString('en-IN') : '-'}</div>
            </div>
            <table className="returns-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Returned</th>
                  <th>Remaining</th>
                  <th>Price</th>
                  <th>Line Total</th>
                </tr>
              </thead>
              <tbody>
                {(billDetails.items || []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-secondary">No bill items found.</td>
                  </tr>
                )}
                {(billDetails.items || []).map((item, idx) => {
                  const qty = Number(item.quantity || 0);
                  const returned = Number(item.returned_quantity || 0);
                  const remaining = Number(item.remaining_quantity || Math.max(qty - returned, 0));
                  const price = Number(item.selling_price || item.price || 0);
                  const lineTotal = Number(item.line_total || qty * price);
                  return (
                    <tr key={`${item.product_id || item.productId || idx}-${idx}`}>
                      <td>{item.product_name || item.name || '-'}</td>
                      <td>{qty}</td>
                      <td>{returned}</td>
                      <td>{remaining}</td>
                      <td>{price.toFixed(2)}</td>
                      <td>{lineTotal.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
};

export default EditBill;
