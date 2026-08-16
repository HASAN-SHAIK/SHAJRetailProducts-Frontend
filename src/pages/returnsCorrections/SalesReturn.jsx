import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { usePopup } from '../../components/common/PopUp/PopupProvider';
import ReturnsHeader from '../../components/returnsCorrections/ReturnsHeader';
import ReturnHistoryPanel from './ReturnHistoryPanel';
import { getBatchCacheById, getLocalSalesReturns, getAllOrderRecords, getOrderItemsByOrderId, upsertLocalCorrection, upsertLocalSalesReturn, upsertLocalGstEntry, refundOrder, refundOrderPartial } from '../../services/local';
import { createCorrection, createOrderReturn, fetchAllSalesOrders } from '../../services/returnsCorrectionsApi';
import { isLocalPosEnabled } from '../../Repositories/local/posLocalApiClient';
import { getOrderRepository } from '../../RepositoryFactory';
import { isEligibleForLocalFullRefund } from './salesReturnPolicy';
import { buildLocalPartialReturnLines } from './salesReturnPartialPolicy';
import { getReturnLineLabel, getReturnLineState } from './salesReturnVisibilityPolicy';
import './ReturnsCorrections.css';

const SalesReturn = () => {
  const { showPopup } = usePopup();
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [items, setItems] = useState([]);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState('');
  const [autoAdjustBill, setAutoAdjustBill] = useState(true);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const localPosMode = isLocalPosEnabled();
  const selectedOrder = useMemo(
    () => orders.find((order) => String(order?.id) === String(selectedOrderId)) || null,
    [orders, selectedOrderId]
  );

  const getBillOptionLabel = (order) => {
    const status = String(order?.order_status || order?.status || '').toLowerCase();
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
    setOrdersLoading(true);
    setOrdersError('');
    try {
      if (localPosMode) {
        try {
          const result = await getOrderRepository().listOrders({ limit: 200 });
          const list = Array.isArray(result?.list) ? result.list : [];
          setOrders(list);
          return;
        } catch {
          setOrdersError('Local POS orders are unavailable. Retry after the POS service is reachable.');
          return;
        }
      }

      if (navigator.onLine) {
        try {
          const list = await fetchAllSalesOrders();
          setOrders(list);
          return;
        } catch {
          // Legacy non-local-POS deployments may continue to the browser cache.
        }
      }
      const localList = await getAllOrderRecords();
      setOrders(localList);
    } finally {
      setOrdersLoading(false);
    }
  }, [localPosMode]);

  const loadItems = useCallback(async () => {
    if (!selectedOrderId) {
      setItems([]);
      setItemsError('');
      return;
    }
    setItemsLoading(true);
    setItemsError('');
    try {
      let orderItems = [];
      if (localPosMode) {
        try {
          const detail = await getOrderRepository().getOrderDetail(selectedOrderId);
          orderItems = Array.isArray(detail?.items)
            ? detail.items
            : Array.isArray(detail?.products)
              ? detail.products
              : [];
        } catch {
          setItems([]);
          setItemsError('Local POS bill details are unavailable. Retry this bill before returning items.');
          return;
        }
      } else {
        orderItems = await getOrderItemsByOrderId(selectedOrderId);
      }

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
          const orderItemId = localPosMode
            ? row.order_item_id ?? row.orderItemId ?? row.id ?? null
            : row.order_item_id ?? row.orderItemId ?? null;
          const productId = row.product_id ?? row.productId ?? row.product?.id ?? row.id;
          const soldQty = row.quantity != null
            ? Number(row.quantity)
            : row.qty != null
              ? Number(row.qty)
              : Number(row.quantity_milli || row.quantityMilli || 0) / 1000;
          const posReturnedQty = row.returned_quantity != null
            ? Number(row.returned_quantity)
            : row.returnedQty != null
              ? Number(row.returnedQty)
              : Number(row.returned_quantity_milli || row.returnedQuantityMilli || 0) / 1000;
          return {
            orderItemId,
            productId,
            name: row.product_name || row.name || row.product?.name || `Product ${productId}`,
            soldQty,
            returnedQty: Math.max(
              posReturnedQty,
              Number(returnedMap.get(String(productId)) || 0)
            ),
            qty: '',
            price: Number(
              row.selling_price ??
              row.price ??
              row.unit_price ??
              ((row.selling_price_minor ?? row.unit_price_minor ?? 0) / 100)
            ),
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
  }, [selectedOrderId, localPosMode]);

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
        const lineState = getReturnLineState(row);
        if (!lineState.isReturnable) return { ...row, qty: '' };
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return { ...row, qty: value };
        const bounded = Math.min(Math.max(numeric, 0), lineState.remaining);
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
        orderItemId: row.orderItemId,
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

    const useLocalFullRefund = localPosMode && isEligibleForLocalFullRefund({
      order: selectedOrder,
      items,
      selectedItems,
    });

    if (useLocalFullRefund) {
      const refundReason = reason.trim();
      if (!refundReason) {
        showPopup('Reason is required for a full POS refund.', 'Validation');
        return;
      }

      setSubmitting(true);
      try {
        await refundOrder(selectedOrderId, { reason: refundReason });
        showPopup('Full sale refunded successfully. Payment and inventory were reversed atomically.', 'Success');
        setReason('');
        setItems([]);
        await loadOrders();
        await loadItems();
        return;
      } catch (error) {
        const code = error?.payload?.error || error?.response?.data?.error || error?.message;
        const message =
          code === 'refund_reconciliation_required'
            ? 'This sale has an existing payment reversal and requires reconciliation before another refund.'
            : code === 'refund_reason_required'
              ? 'Reason is required for this refund.'
              : code || 'Unable to complete the POS refund.';
        showPopup(message, 'Refund Failed');
        return;
      } finally {
        setSubmitting(false);
      }
    }

    const returnId = uuidv4();

    if (localPosMode) {
      const refundReason = reason.trim();
      if (!refundReason) {
        showPopup('Reason is required for a partial POS refund.', 'Validation');
        return;
      }

      let partialLines;
      try {
        partialLines = buildLocalPartialReturnLines(selectedItems);
      } catch (error) {
        const message = error?.message === 'partial_refund_line_identity_required'
          ? 'This local sale is missing an authoritative POS item ID. Refresh the bill from the local POS before returning items.'
          : error?.message || 'Invalid partial return selection.';
        showPopup(message, 'Return Validation');
        return;
      }

      setSubmitting(true);
      try {
        await refundOrderPartial(selectedOrderId, {
          reason: refundReason,
          returnId,
          lines: partialLines,
        });
        showPopup('Partial return completed. Refund and inventory were adjusted atomically.', 'Success');
        setReason('');
        await loadOrders();
        await loadItems();
        setHistoryRefreshKey((value) => value + 1);
        return;
      } catch (error) {
        const code = error?.payload?.error || error?.response?.data?.error || error?.message;
        const message =
          code === 'refund_reconciliation_required'
            ? 'This sale has conflicting refund history and requires reconciliation before another return.'
            : code === 'partial_refund_replay_mismatch'
              ? 'This return identity conflicts with an existing return. Refresh the bill before retrying.'
              : code === 'partial_refund_quantity_exceeded'
                ? 'The selected quantity exceeds the remaining returnable quantity.'
                : code || 'Unable to complete the partial POS refund.';
        showPopup(message, 'Partial Refund Failed');
        return;
      } finally {
        setSubmitting(false);
      }
    }

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
        {ordersError && (
          <div className="alert alert-danger d-flex align-items-center justify-content-between gap-2" role="alert">
            <span>{ordersError}</span>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={loadOrders} disabled={ordersLoading}>
              {ordersLoading ? 'Retrying...' : 'Retry POS orders'}
            </button>
          </div>
        )}
        <div className="row g-2">
          <div className="col-md-4">
            <label className="form-label">Original Bill</label>
            <select
              className="form-select"
              value={selectedOrderId}
              onChange={(event) => setSelectedOrderId(event.target.value)}
              disabled={ordersLoading || Boolean(ordersError)}
              aria-busy={ordersLoading ? 'true' : 'false'}
            >
              <option value="">{ordersLoading ? 'Loading bills...' : 'Select bill'}</option>
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
        {localPosMode && (
          <div className="small text-secondary mt-2">
            Local POS returns are executed atomically at the edge: full selections use full refund, while item-level selections use the certified partial-return flow with manager approval when required.
          </div>
        )}
      </div>

      <ReturnHistoryPanel
        orderId={selectedOrderId}
        enabled={localPosMode}
        refreshKey={historyRefreshKey}
      />

      <div className="returns-card">
        {itemsError && (
          <div className="alert alert-danger d-flex align-items-center justify-content-between gap-2" role="alert">
            <span>{itemsError}</span>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={loadItems} disabled={itemsLoading}>
              {itemsLoading ? 'Retrying...' : 'Retry bill'}
            </button>
          </div>
        )}
        <table className="returns-table" aria-busy={itemsLoading ? 'true' : 'false'}>
          <thead>
            <tr>
              <th>Product</th>
              <th>Sold</th>
              <th>Returned</th>
              <th>Remaining</th>
              <th>Status</th>
              <th>Return Qty</th>
              <th>Batch</th>
            </tr>
          </thead>
          <tbody>
            {itemsLoading && (
              <tr>
                <td colSpan={7} className="text-center text-secondary">
                  Loading items...
                </td>
              </tr>
            )}
            {!itemsLoading && !itemsError && items.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-secondary">
                  No items for this bill.
                </td>
              </tr>
            )}
            {!itemsError && items.map((row, idx) => {
              const lineState = getReturnLineState(row);
              return (
                <tr key={`${row.orderItemId || row.productId}-${idx}`}>
                  <td>{row.name}</td>
                  <td>{row.soldQty}</td>
                  <td>{row.returnedQty}</td>
                  <td>{lineState.remaining}</td>
                  <td>{getReturnLineLabel(row)}</td>
                  <td>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      value={row.qty}
                      min="0"
                      max={lineState.remaining}
                      step="0.001"
                      disabled={!lineState.isReturnable || submitting}
                      onChange={(event) => handleQtyChange(idx, event.target.value)}
                    />
                  </td>
                  <td>{row.batchNumber || row.batchId || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="returns-actions" style={{ marginTop: 12 }}>
          <button className="btn btn-primary" type="button" onClick={handleSubmit} disabled={submitting || Boolean(itemsError) || Boolean(ordersError)}>
            {submitting ? 'Processing...' : 'Save Return'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SalesReturn;