import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { usePopup } from '../../components/common/PopUp/PopupProvider';
import ReturnsHeader from '../../components/returnsCorrections/ReturnsHeader';
import { db, getLocalSalesReturns, upsertLocalSalesReturn, upsertLocalGstEntry } from '../../core/db';
import './ReturnsCorrections.css';

const SalesReturn = () => {
  const { showPopup } = usePopup();
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [items, setItems] = useState([]);
  const [reason, setReason] = useState('');

  const loadOrders = useCallback(async () => {
    const list = await db.orders.toArray();
    setOrders(list);
  }, []);

  const loadItems = useCallback(async () => {
    if (!selectedOrderId) {
      setItems([]);
      return;
    }
    const orderItems = await db.order_items.where('order_id').equals(Number(selectedOrderId)).toArray();
    const existingReturns = await getLocalSalesReturns({ billId: selectedOrderId });
    const returnedMap = new Map();
    existingReturns.forEach((ret) => {
      (ret.items || []).forEach((row) => {
        const key = String(row.productId);
        returnedMap.set(key, (returnedMap.get(key) || 0) + Number(row.quantity || 0));
      });
    });
    setItems(
      orderItems.map((row) => ({
        productId: row.product_id ?? row.productId,
        name: row.product_name || row.name || `Product ${row.product_id}`,
        soldQty: Number(row.quantity || 0),
        returnedQty: Number(returnedMap.get(String(row.product_id)) || 0),
        qty: '',
        price: Number(row.selling_price || row.price || 0),
        gstPercent: Number(row.gst_percent || row.gstPercent || 0),
        batchId: row.batch_id || null,
      }))
    );
  }, [selectedOrderId]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const summary = useMemo(() => {
    let refund = 0;
    let tax = 0;
    items.forEach((item) => {
      const qty = Number(item.qty || 0);
      if (qty > 0) {
        const lineTotal = qty * Number(item.price || 0);
        const gst = (lineTotal * Number(item.gstPercent || 0)) / 100;
        refund += lineTotal;
        tax += gst;
      }
    });
    return { refund, tax };
  }, [items]);

  const handleQtyChange = (index, value) => {
    setItems((prev) =>
      prev.map((row, idx) => {
        if (idx !== index) return row;
        const numeric = Number(value);
        const remaining = Math.max(Number(row.soldQty || 0) - Number(row.returnedQty || 0), 0);
        if (!Number.isFinite(numeric)) return { ...row, qty: value };
        const bounded = Math.min(Math.max(numeric, 0), remaining);
        return { ...row, qty: String(bounded) };
      })
    );
  };

  const handleSubmit = async () => {
    if (!selectedOrderId) {
      showPopup('Select a bill', 'Validation');
      return;
    }
    const selectedItems = items
      .map((row) => ({
        productId: row.productId,
        batchId: row.batchId,
        quantity: Number(row.qty || 0),
        gstPercent: row.gstPercent,
        price: row.price,
      }))
      .filter((row) => row.quantity > 0);
    if (!selectedItems.length) {
      showPopup('Select at least one item to return', 'Validation');
      return;
    }
    const returnId = uuidv4();
    const payload = {
      returnId,
      originalBillId: selectedOrderId,
      items: selectedItems,
      refundAmount: summary.refund,
      taxReversed: summary.tax,
      date: new Date().toISOString(),
      reason: reason.trim(),
      isSynced: false,
      syncAction: 'CREATE',
      updatedAt: new Date().toISOString(),
    };
    await upsertLocalSalesReturn(payload);
    await upsertLocalGstEntry({
      gstEntryId: uuidv4(),
      billId: selectedOrderId,
      type: 'RETURN',
      taxableAmount: summary.refund,
      cgst: summary.tax / 2,
      sgst: summary.tax / 2,
      igst: 0,
      totalTax: summary.tax,
      date: new Date().toISOString().slice(0, 10),
      isSynced: false,
      syncAction: 'CREATE',
      updatedAt: new Date().toISOString(),
    });
    showPopup('Saved Offline', 'Offline');
    setReason('');
    loadItems();
  };

  return (
    <div className="returns-page">
      <ReturnsHeader title="Sales Return" />
      <div className="returns-card">
        <div className="row g-2">
          <div className="col-md-4">
            <label className="form-label">Original Bill</label>
            <select
              className="form-select"
              value={selectedOrderId}
              onChange={(event) => setSelectedOrderId(event.target.value)}
            >
              <option value="">Select bill</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  Bill #{order.id}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">Reason</label>
            <input className="form-control" value={reason} onChange={(event) => setReason(event.target.value)} />
          </div>
          <div className="col-md-4">
            <span className="badge-flag">Refund: {summary.refund.toFixed(2)} | Tax: {summary.tax.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="returns-card">
        <table className="returns-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Sold</th>
              <th>Returned</th>
              <th>Return Qty</th>
              <th>Batch</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-secondary">
                  No items for this bill.
                </td>
              </tr>
            )}
            {items.map((row, idx) => (
              <tr key={`${row.productId}-${idx}`}>
                <td>{row.name}</td>
                <td>{row.soldQty}</td>
                <td>{row.returnedQty}</td>
                <td>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    value={row.qty}
                    min="0"
                    step="0.01"
                    onChange={(event) => handleQtyChange(idx, event.target.value)}
                  />
                </td>
                <td>{row.batchId || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="returns-actions" style={{ marginTop: 12 }}>
          <button className="btn btn-primary" type="button" onClick={handleSubmit}>
            Save Return
          </button>
        </div>
      </div>
    </div>
  );
};

export default SalesReturn;

