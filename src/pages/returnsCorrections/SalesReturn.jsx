import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { usePopup } from '../../components/common/PopUp/PopupProvider';
import ReturnsHeader from '../../components/returnsCorrections/ReturnsHeader';
import { db, getBatchCacheById, getLocalSalesReturns, upsertLocalCorrection, upsertLocalSalesReturn, upsertLocalGstEntry } from '../../core/db';
import { createCorrection, createOrderReturn, fetchAllSalesOrders } from '../../services/returnsCorrectionsApi';
import './ReturnsCorrections.css';

const SalesReturn = () => {
  const { showPopup } = usePopup();
  const [orders, setOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [items, setItems] = useState([]);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [autoAdjustBill, setAutoAdjustBill] = useState(true);
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
        // fallback to local cache
      }
    }
    const localList = await db.orders.toArray();
    setOrders(localList);
  }, []);

  const loadItems = useCallback(async () => {
    if (!selectedOrderId) {
      setItems([]);
      return;
    }
    setItemsLoading(true);
    try {
      let orderItems = [];
      const idText = String(selectedOrderId).trim();
      const idNum = Number(idText);
      const orderItemsByText = await db.order_items.where('order_id').equals(idText).toArray();
      const orderItemsByNumber = Number.isFinite(idNum)
        ? await db.order_items.where('order_id').equals(idNum).toArray()
        : [];
      orderItems = orderItemsByText.length ? orderItemsByText : orderItemsByNumber;

      const existingReturns = await getLocalSalesReturns({ billId: selectedOrderId });
      const returnedMap = new Map();
      existingReturns.forEach((ret) => {
        (ret.items || []).forEach((row) => {
          const key = String(row.productId);
          returnedMap.set(key, (returnedMap.get(key) || 0) + Number(row.quantity || 0));
        });
      });

      const mappedItems = await Promise.all(
        orderItems.map(async (row) => {
          const batchId = row.batch_id || row.batchId || null;
          let batchNumber =
            row.batch_number ||
            row.batchNumber ||
            row.batch_no ||
            row.batchNo ||
            null;
          if (!batchNumber && batchId) {
            const cachedBatch = await getBatchCacheById(batchId).catch(() => null);
            batchNumber = cachedBatch?.batch_number || cachedBatch?.batchNumber || null;
          }
          return {
            productId: row.product_id ?? row.productId,
            name: row.product_name || row.name || `Product ${row.product_id}`,
            soldQty: Number(row.quantity || 0),
            returnedQty: Math.max(
              Number(row.returned_quantity || row.returnedQty || 0),
              Number(returnedMap.get(String(row.product_id ?? row.productId)) || 0)
            ),
            qty: '',
            price: Number(row.selling_price || row.price || row.unit_price || 0),
            gstPercent: Number(row.gst_percent || row.gstPercent || 0),
            batchId,
            batchNumber,
          };
        })
      );
      setItems(mappedItems);
    } finally {
      setItemsLoading(false);
    }
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
    const nowIso = new Date().toISOString();
    const correctionPayload = {
      correctionId: uuidv4(),
      billId: selectedOrderId,
      type: 'UPDATE',
      changes: {
        source: 'sales_return',
        returnId,
        reason: reason.trim() || null,
      },
      adjustedAmount: -Number(summary.refund || 0),
      taxAdjustment: -Number(summary.tax || 0),
      createdAt: nowIso,
      isSynced: false,
      syncAction: 'CREATE',
    };

    if (navigator.onLine) {
      setSubmitting(true);
      try {
        await createOrderReturn(selectedOrderId, {
          returnId,
          items: selectedItems,
          refundMode: 'cash',
          reason: reason.trim(),
        });
        if (autoAdjustBill) {
          try {
            await createCorrection(correctionPayload);
          } catch {
            // non-blocking: return was already completed
          }
        }
        showPopup(
          autoAdjustBill
            ? 'Sales return created and bill adjusted successfully.'
            : 'Sales return created successfully.',
          'Success'
        );
        setReason('');
        await loadItems();
        return;
      } catch {
        // continue to offline fallback
      } finally {
        setSubmitting(false);
      }
    }

    const payload = {
      returnId,
      originalBillId: selectedOrderId,
      items: selectedItems,
      refundAmount: summary.refund,
      taxReversed: summary.tax,
      date: nowIso,
      reason: reason.trim(),
      isSynced: false,
      syncAction: 'CREATE',
      updatedAt: nowIso,
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
      date: nowIso.slice(0, 10),
      isSynced: false,
      syncAction: 'CREATE',
      updatedAt: nowIso,
    });
    if (autoAdjustBill) {
      await upsertLocalCorrection(correctionPayload);
    }
    showPopup(
      autoAdjustBill
        ? 'Sales return created and bill adjusted successfully.'
        : 'Sales return created successfully.',
      'Success'
    );
    setReason('');
    await loadItems();
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
                  {getBillOptionLabel(order)}
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
        <div className="mt-2">
          <label className="form-check-label d-inline-flex align-items-center gap-2">
            <input
              type="checkbox"
              className="form-check-input mt-0"
              checked={autoAdjustBill}
              onChange={(event) => setAutoAdjustBill(Boolean(event.target.checked))}
            />
            Auto-adjust bill after return (create correction record)
          </label>
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
            {itemsLoading && (
              <tr>
                <td colSpan={5} className="text-center text-secondary">
                  Loading items...
                </td>
              </tr>
            )}
            {!itemsLoading && items.length === 0 && (
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
                <td>{row.batchNumber || row.batchId || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="returns-actions" style={{ marginTop: 12 }}>
          <button className="btn btn-primary" type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Processing...' : 'Save Return'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SalesReturn;
