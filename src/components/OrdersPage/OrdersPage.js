import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../utils/axios';
import './OrdersPage.css';
import { usePopup } from '../common/PopUp/PopupProvider';
import { getOfflineOrderQueue, processOfflineQueue } from '../../utils/offlineOrders';
import { useSelector } from 'react-redux';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const OrdersPage = ({ navigate }) => {
  const { showPopup } = usePopup();
  const tenantConfig = useSelector((state) => state.tenant.tenantConfig);
  const planFeatures = tenantConfig?.plan_features || tenantConfig || {};
  const gstInvoiceEnabled = planFeatures.GST_invoice_enabled === true;
  const receiptModuleEnabled = [
    planFeatures.receipt_module_enabled,
    planFeatures.receipt_module,
    planFeatures.enable_receipt,
    tenantConfig?.receipt_module_enabled,
    tenantConfig?.features?.receipt_module,
  ].some((value) => value === true || value === 1 || value === '1' || String(value || '').toLowerCase() === 'true');
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total_pages: 1,
    total_records: 0,
  });
  const [selectedRange, setSelectedRange] = useState('this_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [customRangeKey, setCustomRangeKey] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('id');
  const [sortOrder, setSortOrder] = useState('desc');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState('');
  const [drawerOrder, setDrawerOrder] = useState(null);
  const [paymentSubmittingId, setPaymentSubmittingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [customerDetailsEnabled, setCustomerDetailsEnabled] = useState(false);
  const [shopDetails, setShopDetails] = useState(null);
  const [shopDetailsLoading, setShopDetailsLoading] = useState(false);
  const [gstModalOpen, setGstModalOpen] = useState(false);
  const [gstCustomer, setGstCustomer] = useState({
    name: '',
    mobile: '',
    address: '',
  });
  const [gstSubmitting, setGstSubmitting] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState('');
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [offlineOrders, setOfflineOrders] = useState([]);
  const [syncingOffline, setSyncingOffline] = useState(false);

  const formatDate = useCallback((value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }, []);

  const formatMoney = useCallback((value) => {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(Number.isFinite(amount) ? amount : 0);
  }, []);

  const buildRangeParams = useCallback(() => {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
      range: selectedRange,
      search: searchQuery || undefined,
      sort_by: sortBy,
      sort_order: sortOrder,
    };
    if (selectedRange === 'custom') {
      params.start_date = customStartDate;
      params.end_date = customEndDate;
    }
    return params;
  }, [pagination.page, pagination.limit, selectedRange, customStartDate, customEndDate, searchQuery, sortBy, sortOrder]);

  const fetchOrders = useCallback(async () => {
    if (selectedRange === 'custom' && (!customStartDate || !customEndDate)) {
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await api.get('/orders', { params: buildRangeParams() });
      const payload = res?.data || {};
      setOrders(Array.isArray(payload.orders) ? payload.orders : []);
      setCustomerDetailsEnabled(Boolean(payload.customer_details_enabled));
      setPagination((prev) => ({
        ...prev,
        page: payload.pagination?.page || prev.page,
        limit: payload.pagination?.limit || prev.limit,
        total_pages: payload.pagination?.total_pages || 1,
        total_records: payload.pagination?.total_records || 0,
      }));
    } catch (err) {
        if (err.response?.data?.message === 'Invalid Token' || err.response?.status === 401) {
          showPopup('Token Expired Please Login Again!', 'Session');
          navigate('/logout');
          return;
        }
      setErrorMessage('Unable to load orders. Please try again.');
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [buildRangeParams, customEndDate, customStartDate, navigate, selectedRange, showPopup]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders, customRangeKey]);

  useEffect(() => {
    const refreshPending = async () => {
      try {
        const queue = await getOfflineOrderQueue();
        const list = Array.isArray(queue) ? queue : [];
        setPendingSyncCount(list.length);
        setOfflineOrders(list);
      } catch {
        setPendingSyncCount(0);
        setOfflineOrders([]);
      }
    };
    refreshPending();
    window.addEventListener('focus', refreshPending);
    return () => window.removeEventListener('focus', refreshPending);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination((prev) => ({ ...prev, page: 1 }));
      setSearchQuery(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchOrderDetails = useCallback(async (orderId) => {
    if (!orderId) return;
    setDrawerLoading(true);
    setDrawerError('');
    setDrawerOrder(null);
    try {
      const res = await api.get(`/orders/${orderId}`);
      const payload = res?.data || {};
      setCustomerDetailsEnabled(Boolean(payload.customer_details_enabled));
      setDrawerOrder(payload.order || payload);

      if (gstInvoiceEnabled && !shopDetails && !shopDetailsLoading) {
        setShopDetailsLoading(true);
        try {
          const shopRes = await api.get('/shop-details/me');
          const shopPayload = shopRes?.data?.shop_details || shopRes?.data?.data || shopRes?.data || {};
          setShopDetails(shopPayload);
        } catch (innerErr) {
          // non-blocking for order drawer
          console.error('Failed to load shop details', innerErr);
        } finally {
          setShopDetailsLoading(false);
        }
      }
    } catch (err) {
      setDrawerError('Unable to load order details.');
    } finally {
      setDrawerLoading(false);
    }
  }, []);

  const openDrawer = useCallback((orderId) => {
    setDrawerOpen(true);
    fetchOrderDetails(orderId);
  }, [fetchOrderDetails]);

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDrawerOrder(null);
    setDrawerError('');
  };

  const handleRangeChange = (value) => {
    setSelectedRange(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleApplyCustomRange = () => {
    if (!customStartDate || !customEndDate) {
      showPopup('Please select start and end dates', 'Validation');
      return;
    }
    setPagination((prev) => ({ ...prev, page: 1 }));
    setCustomRangeKey((prev) => prev + 1);
  };

  const handlePaymentAction = async (event, targetOrder) => {
    if (event) {
      event.stopPropagation();
    }
    const order = targetOrder || drawerOrder;
    if (!order?.id) return;
    if (paymentSubmittingId === order.id) return;

    const paymentMode =
      order.payment_method ||
      order.payment_mode ||
      order.payment ||
      'cash';

    try {
      setPaymentSubmittingId(order.id);
      await api.post('/orders/mark-paid', {
        order_id: order.id,
        payment_mode: paymentMode,
      });
      fetchOrders();
      if (drawerOpen) {
        fetchOrderDetails(order.id);
      }
    } catch (err) {
        if (err.response?.data?.message === 'Invalid Token' || err.response?.status === 401) {
          showPopup('Token Expired Please Login Again!', 'Session');
          navigate('/logout');
          return;
        }
      showPopup('Failed to mark order as paid.', 'Error');
    } finally {
      setPaymentSubmittingId((current) => (current === order.id ? null : current));
    }
  };

  const openGstModal = () => {
    if (!drawerOrder) return;
    const customer = drawerOrder.customer || {};
    setGstCustomer({
      name: customer.name || drawerOrder.customer_name || '',
      mobile: customer.mobile || customer.phone || drawerOrder.customer_phone || '',
      address: customer.address || drawerOrder.customer_address || '',
    });
    setGstModalOpen(true);
  };

  const openReceipt = () => {
    setReceiptOpen(true);
  };

  const closeReceipt = () => {
    setReceiptOpen(false);
    setReceiptLoading(false);
    setReceiptError('');
    setReceiptOrder(null);
  };

  const handleOfflineSync = async () => {
    if (!navigator.onLine) return;
    if (syncingOffline) return;
    try {
      setSyncingOffline(true);
      await processOfflineQueue(api);
    } catch (err) {
      console.error('Offline order sync failed', err);
    } finally {
      setSyncingOffline(false);
      try {
        const queue = await getOfflineOrderQueue();
        const list = Array.isArray(queue) ? queue : [];
        setPendingSyncCount(list.length);
        setOfflineOrders(list);
      } catch {
        setPendingSyncCount(0);
        setOfflineOrders([]);
      }
      fetchOrders();
    }
  };

  const formatReceiptAmount = (value) => {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric)) return '0';
    return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2);
  };

  const padRight = (value, width) => String(value ?? '').padEnd(width, ' ');
  const padLeft = (value, width) => String(value ?? '').padStart(width, ' ');

  const wrapText = (value, width) => {
    const text = String(value ?? '');
    if (!text) return [''];
    const lines = [];
    for (let i = 0; i < text.length; i += width) {
      lines.push(text.slice(i, i + width));
    }
    return lines;
  };

  const buildReceiptLines = (order) => {
    const shop = order?.shop_details || order?.shop || order?.store || {};
    const shopName =
      shop.shop_name ||
      shop.name ||
      shop.business_name ||
      tenantConfig?.shop_name ||
      tenantConfig?.name ||
      'Your Shop';
    const shopAddress =
      shop.address_line ||
      shop.address ||
      shop.shop_address ||
      shop.address1 ||
      tenantConfig?.address ||
      '';
    const shopPhone =
      shop.phone ||
      shop.mobile ||
      shop.mobile_number ||
      shop.contact_number ||
      tenantConfig?.phone ||
      '';

    const orderId = order?.id || '-';
    const orderDate = formatDate(order?.created_at);
    const paymentMode =
      order?.payment_method ||
      order?.payment_mode ||
      order?.payment ||
      'Cash';

    const items = Array.isArray(order?.items)
      ? order.items
      : Array.isArray(order?.products)
        ? order.products
        : [];

    const headerLine = `${padRight('Item Name', 20)}${padLeft('Qty', 4)}${padLeft('Rate', 6)}${padLeft('Net', 8)}`;
    const lines = [
      shopName,
      shopAddress,
      shopPhone,
      '',
      `Order ID: ${orderId}`,
      `Date: ${orderDate}`,
      `Payment: ${paymentMode}`,
      '',
      headerLine,
    ];

    items.forEach((item) => {
      const name = item?.product_name || item?.name || '-';
      const qty = formatReceiptAmount(item?.quantity || item?.qty || 0);
      const rate = formatReceiptAmount(item?.price || item?.selling_price || 0);
      const netValue = item?.total || item?.line_total || (Number(item?.quantity || item?.qty || 0) * Number(item?.price || item?.selling_price || 0));
      const net = formatReceiptAmount(netValue);
      const nameLines = wrapText(name, 20);
      nameLines.forEach((line, index) => {
        if (index === 0) {
          lines.push(`${padRight(line, 20)}${padLeft(qty, 4)}${padLeft(rate, 6)}${padLeft(net, 8)}`);
        } else {
          lines.push(`${padRight(line, 20)}${padRight('', 4)}${padRight('', 6)}${padRight('', 8)}`);
        }
      });
    });

    lines.push('');
    lines.push('---');
    lines.push(`Total: ${formatReceiptAmount(order?.total_amount || order?.total || 0)}`);
    lines.push(`Payment: ${paymentMode}`);
    lines.push('');
    lines.push('Thank You Visit Again');

    return lines.join('\n');
  };

  const handleReceiptPrint = () => {
    window.print();
  };

  const handlePrintAction = async (event, order) => {
    if (event) {
      event.stopPropagation();
    }
    if (!receiptModuleEnabled) return;
    if (!order?.id) return;
    setReceiptLoading(true);
    setReceiptError('');
    setReceiptOrder(null);
    openReceipt();
    try {
      const res = await api.get(`/orders/${order.id}`);
      const payload = res?.data || {};
      setReceiptOrder(payload.order || payload);
    } catch (err) {
      setReceiptError('Unable to load receipt.');
    } finally {
      setReceiptLoading(false);
    }
  };

  const closeGstModal = () => {
    setGstModalOpen(false);
  };

  const handleGstSubmit = async (event) => {
    event.preventDefault();
    if (!drawerOrder?.id) return;
    if (!gstCustomer.name.trim() || !gstCustomer.mobile.trim()) {
      showPopup('Customer name and mobile are required for GST invoice.', 'Validation');
      return;
    }
    try {
      setGstSubmitting(true);
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const left = 14;
      const right = pageWidth - 14;
      let y = 18;

      const formatINR = (value) => `INR ${Number(value || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

      const shop = shopDetails || {};
      const shopName = shop.shop_name || shop.name || shop.business_name || 'Your Shop Name';
      const shopGST = shop.gst_number || shop.gstin || shop.gstin_number || 'GSTIN NOT PROVIDED';
      const addressLine = shop.address_line || shop.address || shop.shop_address || shop.address1 || '';
      const city = shop.city || shop.town || '';
      const state = shop.state || shop.region || '';
      const pincode = shop.pincode || shop.postal_code || shop.zip || '';
      const shopAddress = [addressLine, city, state, pincode].filter(Boolean).join(', ');
      const shopContact = [
        shop.phone || shop.mobile || shop.mobile_number || shop.contact_number,
        shop.email || shop.contact_email,
      ].filter(Boolean).join(' | ');

      doc.setFillColor(18, 42, 67);
      doc.rect(0, 0, pageWidth, 32, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('TAX INVOICE', left, 18);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Original for Recipient', left, 26);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(shopName, right, 18, { align: 'right' });
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      if (shopAddress) doc.text(shopAddress, right, 24, { align: 'right' });
      if (shopContact) doc.text(shopContact, right, 29, { align: 'right' });

      y = 40;
      doc.setTextColor(33, 33, 33);
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);

      const billToMaxWidth = right - (left + 100);
      const addressLines = gstCustomer.address
        ? doc.splitTextToSize(`Address: ${gstCustomer.address}`, billToMaxWidth)
        : [];
      const invoiceLines = [
        `Invoice No: ${drawerOrder.id}`,
        `Invoice Date: ${formatDate(drawerOrder.created_at)}`,
        `GSTIN: ${shopGST}`,
      ];
      const billToLines = [
        `${gstCustomer.name}`,
        `Mobile: ${gstCustomer.mobile}`,
        ...addressLines,
      ];
      const maxLines = Math.max(invoiceLines.length, billToLines.length);
      const lineHeight = 6;
      const boxHeight = 12 + maxLines * lineHeight;

      doc.rect(left, y, pageWidth - left * 2, boxHeight);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Invoice Details', left + 4, y + 7);
      doc.text('Bill To', left + 100, y + 7);
      doc.setFont('helvetica', 'normal');

      invoiceLines.forEach((line, idx) => {
        doc.text(line, left + 4, y + 14 + idx * lineHeight);
      });

      billToLines.forEach((line, idx) => {
        doc.text(line, left + 100, y + 14 + idx * lineHeight);
      });

      y += boxHeight + 8;

      const rows = drawerItems.map((item, index) => {
        const qty = Number(item.quantity || item.qty || 0);
        const rate = Number(item.price || item.selling_price || 0);
        const lineTotal = Number(item.total || item.line_total || qty * rate);
        const hsn = item.hsn || item.hsn_code || 'NA';
        return [
          index + 1,
          item.name || item.product_name || '-',
          hsn,
          qty || 0,
          formatINR(rate),
          formatINR(lineTotal),
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [['#', 'Item', 'HSN', 'Qty', 'Rate', 'Amount']],
        body: rows,
        theme: 'grid',
        styles: {
          fontSize: 9,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [233, 238, 245],
          textColor: 33,
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { cellWidth: 8 },
          2: { cellWidth: 22 },
          3: { cellWidth: 12, halign: 'right' },
          4: { cellWidth: 28, halign: 'right' },
          5: { cellWidth: 30, halign: 'right' },
        },
      });

      y = doc.lastAutoTable.finalY + 8;

      const subTotal = rows.reduce((sum, row) => {
        const amount = Number(String(row[5]).replace(/[^0-9.]/g, '')) || 0;
        return sum + amount;
      }, 0);
      const taxableAmount = subTotal;
      const cgstRate = 0.09;
      const sgstRate = 0.09;
      const cgst = taxableAmount * cgstRate;
      const sgst = taxableAmount * sgstRate;
      const totalTax = cgst + sgst;
      const grandTotal = taxableAmount + totalTax;

      doc.setDrawColor(220, 220, 220);
      doc.rect(pageWidth - 80, y, 66, 30);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Taxable Amount', pageWidth - 76, y + 6);
      doc.text(formatINR(subTotal), right - 2, y + 6, { align: 'right' });
      doc.text('CGST (9%)', pageWidth - 76, y + 12);
      doc.text(formatINR(cgst), right - 2, y + 12, { align: 'right' });
      doc.text('SGST (9%)', pageWidth - 76, y + 18);
      doc.text(formatINR(sgst), right - 2, y + 18, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text('Total Amount', pageWidth - 76, y + 26);
      doc.text(formatINR(grandTotal), right - 2, y + 26, { align: 'right' });
      doc.setFont('helvetica', 'normal');

      const footerY = Math.max(y + 40, pageHeight - 50);
      doc.setDrawColor(200, 200, 200);
      doc.line(left, footerY - 12, right, footerY - 12);
      doc.setFontSize(9);
      doc.text('Customer Signature', left, footerY);
      doc.text('Authorized Signatory', right, footerY, { align: 'right' });
      doc.setFontSize(8);
      doc.text('This is a computer-generated invoice. No signature required.', pageWidth / 2, footerY + 10, { align: 'center' });

      doc.save(`GST-Invoice-${drawerOrder.id}.pdf`);

      setGstModalOpen(false);
      showPopup('GST invoice downloaded.', 'Success');
    } catch (err) {
      showPopup('Failed to generate GST invoice.', 'Error');
    } finally {
      setGstSubmitting(false);
    }
  };

  const openDeleteModal = (event, order) => {
    event.stopPropagation();
    setDeleteTarget(order);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setDeleteTarget(null);
  };

  const handleDeleteOrder = async () => {
    const orderId = deleteTarget?.id;
    if (!orderId) return;
    setDeletingId(orderId);
    try {
      await api.delete(`/orders/${orderId}`);
      showPopup('Order deleted', 'Success');
      closeDeleteModal();
      fetchOrders();
    } catch (err) {
      showPopup('Failed to delete order', 'Error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleRowClick = (orderId) => {
    openDrawer(orderId);
  };

  const handleSortToggle = (field) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const getSortIndicator = (field) => {
    if (sortBy !== field) return '';
    return sortOrder === 'asc' ? '▲' : '▼';
  };

  const getProductNames = (order) => {
    if (Array.isArray(order?.product_names)) {
      return order.product_names.filter(Boolean).map(String);
    }
    if (Array.isArray(order?.products)) {
      return order.products
        .map((p) => (typeof p === 'string' ? p : p?.name || p?.product_name || ''))
        .filter(Boolean);
    }
    if (Array.isArray(order?.items)) {
      return order.items
        .map((item) => item?.product_name || item?.name || '')
        .filter(Boolean);
    }
    return [];
  };

  const renderProductSummary = (order) => {
    const names = getProductNames(order);
    if (names.length === 0) return order.products_summary || '-';
    const displayCount = 3;
    const shown = names.slice(0, displayCount);
    const remaining = names.length - shown.length;
    const label = remaining > 0
      ? `${shown.join(', ')} +${remaining} more`
      : shown.join(', ');
    return (
      <span className="product-summary" title={names.join(', ')}>
        {label}
      </span>
    );
  };

  const pages = useMemo(() => {
    const total = pagination.total_pages || 1;
    return Array.from({ length: total }, (_, idx) => idx + 1);
  }, [pagination.total_pages]);

  const renderPaymentCell = (order) => {
    const status = order.payment_status;
    if (status === 'paid') {
      return <span className="payment-badge paid">Completed</span>;
    }
    if (status === 'partial') {
      return (
        <button
          className="payment-btn warning"
          onClick={(event) => handlePaymentAction(event, order)}
          disabled={paymentSubmittingId === order.id}
        >
          {paymentSubmittingId === order.id ? 'Saving...' : 'Pay Balance'}
        </button>
      );
    }
    return (
      <button
        className="payment-btn danger"
        onClick={(event) => handlePaymentAction(event, order)}
        disabled={paymentSubmittingId === order.id}
      >
        {paymentSubmittingId === order.id ? 'Saving...' : 'Make Payment'}
      </button>
    );
  };

  const drawerItems = Array.isArray(drawerOrder?.items)
    ? drawerOrder.items
    : Array.isArray(drawerOrder?.products)
      ? drawerOrder.products
      : [];

  const paymentHistory = Array.isArray(drawerOrder?.payment_history)
    ? drawerOrder.payment_history
    : Array.isArray(drawerOrder?.payments)
      ? drawerOrder.payments
      : [];

  const customer = drawerOrder?.customer || {};
  const balance = Number(drawerOrder?.balance || 0);

  const hasActions = orders.some(
    (order) => String(order.order_status || '').toLowerCase() === 'completed'
  ) && receiptModuleEnabled;

  return (
    <div className="orders-page">
      <div className="mb-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div className="text-muted">
          Offline queue: {pendingSyncCount}
        </div>
        <button
          type="button"
          className="btn btn-outline-primary"
          onClick={handleOfflineSync}
          disabled={!navigator.onLine || syncingOffline || pendingSyncCount === 0}
        >
          {syncingOffline ? 'Syncing...' : 'Sync Offline Orders'}
        </button>
      </div>
      {offlineOrders.length > 0 && (
        <div className="orders-card mb-3">
          <div className="orders-card-header">
            <h5 className="mb-0">Pending Offline Orders</h5>
          </div>
          <div className="orders-table-wrapper">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Local ID</th>
                  <th>Type</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Created</th>
                  <th>Items</th>
                </tr>
              </thead>
              <tbody>
                {offlineOrders.map((entry) => {
                  const payload = entry.payload || {};
                  const items = Array.isArray(payload.products) ? payload.products : [];
                  const total = payload.total_amount ?? payload.total_price ?? 0;
                  const payment =
                    payload.payment_method ||
                    payload.payment_mode ||
                    payload.payment ||
                    '-';
                  const type = payload.transaction_type || payload.type || entry.type || '-';
                  return (
                    <tr key={entry.id}>
                      <td>{entry.id}</td>
                      <td>{type}</td>
                      <td>{formatMoney(total)}</td>
                      <td>{payment}</td>
                      <td>{formatDate(entry.createdAt)}</td>
                      <td>{items.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="orders-page-header">
        <div>
          {/* <h2 className="orders-title">Orders</h2> */}
          {/* <p className="orders-subtitle">Clean, paginated view of recent orders.</p> */}
        </div>
        <div className="orders-controls">
          <input
            className="form-control search-input"
            placeholder="Search by Order ID, Customer, or Product"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <div className="orders-controls-right">
            <div className="sort-controls">
              <select
                className="form-select sort-select"
                value={sortBy}
                onChange={(event) => handleSortToggle(event.target.value)}
              >
                <option value="id">Sort by Order ID</option>
                <option value="created_at">Sort by Date</option>
                <option value="total_amount">Sort by Total Amount</option>
                <option value="total_paid">Sort by Total Paid</option>
                <option value="balance">Sort by Balance</option>
              </select>
              <button
                className="btn btn-outline-primary btn-sm"
                onClick={() => {
                  setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                type="button"
              >
                {sortOrder === 'asc' ? 'Asc' : 'Desc'}
              </button>
            </div>
            <select
              className="form-select range-select"
              value={selectedRange}
              onChange={(event) => handleRangeChange(event.target.value)}
            >
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="last_30_days">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>
            {selectedRange === 'custom' && (
              <div className="range-custom">
                <input
                  type="date"
                  className="form-control"
                  value={customStartDate}
                  onChange={(event) => setCustomStartDate(event.target.value)}
                />
                <span className="range-separator">to</span>
                <input
                  type="date"
                  className="form-control"
                  value={customEndDate}
                  onChange={(event) => setCustomEndDate(event.target.value)}
                />
                <button className="btn btn-primary btn-sm" onClick={handleApplyCustomRange}>
                  Apply
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="orders-card">
        <div className="orders-table-wrapper">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Products</th>
                {customerDetailsEnabled && <th>Customer</th>}
                <th role="button" onClick={() => handleSortToggle('total_amount')} className="sortable">
                  Total <span className="sort-indicator">{getSortIndicator('total_amount')}</span>
                </th>
                <th>Payment</th>
                <th role="button" onClick={() => handleSortToggle('created_at')} className="sortable">
                  Date <span className="sort-indicator">{getSortIndicator('created_at')}</span>
                </th>
                {hasActions && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 6 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} className="skeleton-row">
                  <td><span className="skeleton-block" /></td>
                  <td><span className="skeleton-block" /></td>
                  {customerDetailsEnabled && <td><span className="skeleton-block" /></td>}
                  <td><span className="skeleton-block" /></td>
                  <td><span className="skeleton-block" /></td>
                  <td><span className="skeleton-block" /></td>
                  {hasActions && <td><span className="skeleton-block" /></td>}
                </tr>
              ))}
              {!isLoading && errorMessage && (
                <tr>
                  <td colSpan={customerDetailsEnabled ? (hasActions ? 7 : 6) : (hasActions ? 6 : 5)} className="empty-state">{errorMessage}</td>
                </tr>
              )}
              {!isLoading && !errorMessage && orders.length === 0 && (
                <tr>
                  <td colSpan={customerDetailsEnabled ? (hasActions ? 7 : 6) : (hasActions ? 6 : 5)} className="empty-state">No orders found.</td>
                </tr>
              )}
              {!isLoading && !errorMessage && orders.map((order) => (
                <tr
                  key={order.id}
                  className="orders-row"
                  onClick={() => handleRowClick(order.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      handleRowClick(order.id);
                    }
                  }}
                >
                  <td>#{order.id}</td>
                  <td>{renderProductSummary(order)}</td>
                  {customerDetailsEnabled && <td>{order.customer_name || '-'}</td>}
                  <td>{formatMoney(order.total_amount)}</td>
                  <td>{renderPaymentCell(order)}</td>
                  <td>{formatDate(order.created_at)}</td>
                  {hasActions && (
                    <td>
                      {String(order.order_status || '').toLowerCase() === 'completed' && receiptModuleEnabled && (
                        <button
                          className="btn btn-outline-primary btn-sm"
                          type="button"
                          onClick={(event) => handlePrintAction(event, order)}
                        >
                          Print
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="orders-pagination">
          <button
            className="page-btn"
            disabled={pagination.page <= 1}
            onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
          >
            Prev
          </button>
          <div className="page-list">
            {pages.map((page) => (
              <button
                key={`page-${page}`}
                className={`page-btn ${page === pagination.page ? 'active' : ''}`}
                onClick={() => setPagination((prev) => ({ ...prev, page }))}
              >
                {page}
              </button>
            ))}
          </div>
          <button
            className="page-btn"
            disabled={pagination.page >= pagination.total_pages}
            onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
          >
            Next
          </button>
        </div>
      </div>

      {drawerOpen && (
        <div className="order-drawer-overlay" onClick={closeDrawer}>
          <aside className="order-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <p className="drawer-eyebrow">Order #{drawerOrder?.id || '-'}</p>
                <h3 className="drawer-title">{formatDate(drawerOrder?.created_at)}</h3>
              </div>
              <button className="drawer-close" onClick={closeDrawer} type="button">Close</button>
            </div>

            {drawerLoading && (
              <div className="drawer-loading">
                <span className="skeleton-block large" />
                <span className="skeleton-block" />
                <span className="skeleton-block" />
              </div>
            )}

            {!drawerLoading && drawerError && (
              <div className="drawer-empty">{drawerError}</div>
            )}

            {!drawerLoading && !drawerError && drawerOrder && (
              <div className="drawer-content">
                {customerDetailsEnabled && (
                  <section className="drawer-section">
                    <h4>Customer</h4>
                    <div className="drawer-grid">
                      <div>
                        <span className="label">Name</span>
                        <p>{customer.name || drawerOrder.customer_name || '-'}</p>
                      </div>
                      <div>
                        <span className="label">Phone</span>
                        <p>{customer.mobile || customer.phone || drawerOrder.customer_phone || '-'}</p>
                      </div>
                      <div>
                        <span className="label">Address</span>
                        <p>{customer.address || drawerOrder.customer_address || '-'}</p>
                      </div>
                    </div>
                  </section>
                )}

                <section className="drawer-section">
                  <h4>Products</h4>
                  <table className="drawer-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drawerItems.length === 0 && (
                        <tr>
                          <td colSpan={4} className="drawer-empty">No items available.</td>
                        </tr>
                      )}
                      {drawerItems.map((item, idx) => (
                        <tr key={`item-${idx}`}>
                          <td>{item.name || item.product_name || '-'}</td>
                          <td>{item.quantity || item.qty || '-'}</td>
                          <td>{formatMoney(item.price || item.selling_price)}</td>
                          <td>{formatMoney(item.total || item.line_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                <section className="drawer-section summary">
                  <h4>Payment Summary</h4>
                  <div className="summary-grid">
                    <div>
                      <span>Total Amount</span>
                      <strong>{formatMoney(drawerOrder.total_amount)}</strong>
                    </div>
                    <div>
                      <span>Total Paid</span>
                      <strong>{formatMoney(drawerOrder.total_paid)}</strong>
                    </div>
                    <div>
                      <span>Balance</span>
                      <strong>{formatMoney(drawerOrder.balance)}</strong>
                    </div>
                  </div>
                </section>

                <section className="drawer-section">
                  <h4>Payment History</h4>
                  <table className="drawer-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Method</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentHistory.length === 0 && (
                        <tr>
                          <td colSpan={3} className="drawer-empty">No payments recorded.</td>
                        </tr>
                      )}
                      {paymentHistory.map((payment, idx) => (
                        <tr key={`payment-${idx}`}>
                          <td>{formatDate(payment.date || payment.paid_at)}</td>
                          <td>{payment.method || payment.mode || '-'}</td>
                          <td>{formatMoney(payment.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                <section className="drawer-section actions">
                  {balance > 0 ? (
                    <button
                      className="btn btn-primary"
                      onClick={(event) => handlePaymentAction(event, drawerOrder)}
                      disabled={paymentSubmittingId === drawerOrder?.id}
                    >
                      {paymentSubmittingId === drawerOrder?.id ? 'Saving...' : 'Add Payment'}
                    </button>
                  ) : (
                    <span className="payment-badge paid">Fully Paid</span>
                  )}
                  <button
                    className="btn btn-outline-light"
                    type="button"
                    onClick={openGstModal}
                    disabled={drawerLoading || !gstInvoiceEnabled}
                    title={!gstInvoiceEnabled ? 'Available on Pro plan' : undefined}
                  >
                    Download GST Invoice
                    {!gstInvoiceEnabled && <span className="lock-tag">PRO</span>}
                  </button>
                  <button
                    className="btn btn-outline-danger"
                    onClick={(event) => openDeleteModal(event, drawerOrder)}
                    disabled={drawerOrder.payment_status === 'paid'}
                  >
                    Delete Order
                  </button>
                </section>
              </div>
            )}
          </aside>
        </div>
      )}
      {deleteModalOpen && (
        <div className="delete-modal-overlay" onClick={closeDeleteModal}>
          <div className="delete-modal" onClick={(event) => event.stopPropagation()}>
            <h4>Delete order?</h4>
            <p>Are you sure you want to delete order #{deleteTarget?.id}?</p>
            {Number(deleteTarget?.total_paid || 0) > 0 && (
              <p className="delete-warning">Warning: This order has payments recorded.</p>
            )}
            <div className="delete-actions">
              <button className="btn btn-outline-secondary" onClick={closeDeleteModal}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDeleteOrder} disabled={deletingId === deleteTarget?.id}>
                {deletingId === deleteTarget?.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      {gstModalOpen && (
        <div className="delete-modal-overlay" onClick={closeGstModal}>
          <div className="delete-modal" onClick={(event) => event.stopPropagation()}>
            <h4>GST Invoice Details</h4>
            {shopDetails && (
              <p className="mb-2">
                <strong>{shopDetails.shop_name || shopDetails.name || shopDetails.business_name}</strong>
                {(shopDetails.gst_number || shopDetails.gstin || shopDetails.gstin_number) && (
                  <> · GST: {shopDetails.gst_number || shopDetails.gstin || shopDetails.gstin_number}</>
                )}
              </p>
            )}
            <form onSubmit={handleGstSubmit}>
              <div className="mb-2">
                <label className="form-label">Customer Name</label>
                <input
                  className="form-control"
                  value={gstCustomer.name}
                  onChange={(event) =>
                    setGstCustomer((prev) => ({ ...prev, name: event.target.value }))
                  }
                  required
                />
              </div>
              <div className="mb-2">
                <label className="form-label">Mobile Number</label>
                <input
                  className="form-control"
                  value={gstCustomer.mobile}
                  onChange={(event) =>
                    setGstCustomer((prev) => ({ ...prev, mobile: event.target.value }))
                  }
                  required
                />
              </div>
              <div className="mb-2">
                <label className="form-label">Address (optional)</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={gstCustomer.address}
                  onChange={(event) =>
                    setGstCustomer((prev) => ({ ...prev, address: event.target.value }))
                  }
                />
              </div>
              <div className="delete-actions">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={closeGstModal}
                  disabled={gstSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={gstSubmitting}
                >
                  {gstSubmitting ? 'Generating...' : 'Download PDF'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {receiptOpen && (
        <div className="delete-modal-overlay" onClick={closeReceipt}>
          <div className="receipt-modal" onClick={(event) => event.stopPropagation()}>
            <div className="receipt-header">
              <h4>Receipt Preview</h4>
              <button className="btn btn-outline-secondary btn-sm" onClick={closeReceipt} type="button">
                Close
              </button>
            </div>
            {receiptLoading && <div className="receipt-loading">Loading receipt...</div>}
            {!receiptLoading && receiptError && <div className="receipt-error">{receiptError}</div>}
            {!receiptLoading && !receiptError && receiptOrder && (
              <>
                <div className="receipt-preview">
                  <pre>{buildReceiptLines(receiptOrder)}</pre>
                </div>
                <div className="receipt-actions">
                  <button className="btn btn-primary" onClick={handleReceiptPrint} type="button">
                    Print
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
