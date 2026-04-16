import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../utils/axios';
import './OrdersPage.css';
import { usePopup } from '../common/PopUp/PopupProvider';
import { enqueueOfflineOrder } from '../../utils/offlineOrders';
import {
  clearOrdersCache,
  getAllCachedOrders,
  getCachedOrderDetails,
  getCachedOrderById,
  getCachedOrderTransactions,
  replaceAllOrders,
  upsertOrderDetailsCache,
  upsertOrders,
} from '../../db/ordersDb';
import { getSessionValue, saveSessionValue, saveTransactionsBulk } from '../../core/db';
import { useSelector } from 'react-redux';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import WhatsAppModal from '../WhatsApp/WhatsAppModal';
import SendWhatsAppButton from '../WhatsApp/SendWhatsAppButton';
import { sendBillViaWhatsApp } from '../../services/whatsappService';
import { useWhatsappStore } from '../../store/whatsappStore';
import { useBranchStore } from '../../store/branchStore';
import { getTenantFeatures, hasFeature } from '../../utils/entitlements';

const OrdersPage = ({ navigate }) => {
  const ORDER_CACHE_FULL_SYNC_LIMIT = 2000;
  const ORDER_CACHE_PAGE_SIZE = 100;
  const { showPopup } = usePopup();
  const tenantConfig = useSelector((state) => state.tenant.tenantConfig);
  const planFeatures = getTenantFeatures(tenantConfig);
  const gstInvoiceEnabled = hasFeature(tenantConfig, 'gst_invoice_enabled');
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
  const [paymentAmount, setPaymentAmount] = useState('');
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
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnError, setReturnError] = useState('');
  const [returnOrder, setReturnOrder] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnReason, setReturnReason] = useState('Damaged');
  const [refundMode, setRefundMode] = useState('cash');
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [whatsappSending, setWhatsappSending] = useState(false);
  const [whatsappTarget, setWhatsappTarget] = useState(null);
  const cacheSyncRef = useRef(false);
  const whatsappEnabled = useWhatsappStore((state) => state.whatsappEnabled);
  const selectedOrderId = useWhatsappStore((state) => state.selectedOrderId);
  const setSelectedOrderId = useWhatsappStore((state) => state.setSelectedOrderId);
  const whatsappPhone = useWhatsappStore((state) => state.phone);
  const setWhatsappPhone = useWhatsappStore((state) => state.setPhone);
  const resetWhatsappState = useWhatsappStore((state) => state.resetWhatsappState);
  const selectedBranchId = useBranchStore((state) => state.selectedBranchId);
  const effectiveBranchId = selectedBranchId && selectedBranchId !== 'all' ? selectedBranchId : null;

  const RETURN_REASONS = [
    'Damaged',
    'Wrong item',
    'Customer changed mind',
    'Billing mistake',
    'Expired',
    'Other',
  ];
  const REFUND_MODES = ['cash', 'upi', 'bank', 'wallet', 'exchange'];

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
  }, [gstInvoiceEnabled, shopDetails, shopDetailsLoading]);

  const getBillingType = useCallback((order = {}) => {
    const raw = String(order?.billing_type || order?.billingType || '').trim().toLowerCase();
    if (raw === 'wholesale') return 'wholesale';
    return 'retail';
  }, []);

  const generateLocalTxnId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `local-pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  };

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

  const loadCachedOrders = useCallback(async () => {
    try {
      const allOrders = await getAllCachedOrders();
      let filtered = Array.isArray(allOrders) ? allOrders.slice() : [];

      if (effectiveBranchId) {
        filtered = filtered.filter((order) => order.branch_id === effectiveBranchId);
      }

      if (searchQuery) {
        const term = searchQuery.toLowerCase();
        filtered = filtered.filter((order) => {
          const idMatch = String(order.id || '').toLowerCase().includes(term);
          const customerMatch =
            String(order.customer_name || '').toLowerCase().includes(term) ||
            String(order.customer_phone || '').toLowerCase().includes(term);
          const productMatch =
            String(order.products_summary || '').toLowerCase().includes(term) ||
            (Array.isArray(order.product_names) &&
              order.product_names.join(' ').toLowerCase().includes(term));
          return idMatch || customerMatch || productMatch;
        });
      }

      if (selectedRange) {
        const now = new Date();
        let rangeStart = null;
        let rangeEnd = null;
        if (selectedRange === 'today') {
          rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          rangeEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        } else if (selectedRange === 'this_week') {
          const day = now.getDay();
          const diff = now.getDate() - day;
          rangeStart = new Date(now.getFullYear(), now.getMonth(), diff);
          rangeEnd = new Date(rangeStart);
          rangeEnd.setDate(rangeStart.getDate() + 6);
          rangeEnd.setHours(23, 59, 59, 999);
        } else if (selectedRange === 'this_month') {
          rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
          rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        } else if (selectedRange === 'custom' && customStartDate && customEndDate) {
          rangeStart = new Date(customStartDate);
          rangeEnd = new Date(customEndDate);
          rangeEnd.setHours(23, 59, 59, 999);
        }
        if (rangeStart && rangeEnd) {
          filtered = filtered.filter((order) => {
            const createdAt = new Date(order.created_at);
            if (Number.isNaN(createdAt.getTime())) return false;
            return createdAt >= rangeStart && createdAt <= rangeEnd;
          });
        }
      }

      const direction = sortOrder === 'asc' ? 1 : -1;
      filtered.sort((a, b) => {
        if (sortBy === 'total_amount') {
          return (Number(a.total_amount || 0) - Number(b.total_amount || 0)) * direction;
        }
        if (sortBy === 'created_at') {
          return String(a.created_at || '').localeCompare(String(b.created_at || '')) * direction;
        }
        const aId = Number(a.id);
        const bId = Number(b.id);
        if (Number.isFinite(aId) && Number.isFinite(bId)) {
          return (aId - bId) * direction;
        }
        return String(a.created_at || '').localeCompare(String(b.created_at || '')) * direction;
      });

      const total = filtered.length;
      const startIndex = (pagination.page - 1) * pagination.limit;
      const pageOrders = filtered.slice(startIndex, startIndex + pagination.limit);
      setOrders(pageOrders);
      setErrorMessage('');
      setPagination((prev) => ({
        ...prev,
        total_records: total,
        total_pages: total ? Math.max(Math.ceil(total / prev.limit), 1) : 1,
      }));
    } catch {
      // ignore cache errors
    }
  }, [
    pagination.page,
    pagination.limit,
    searchQuery,
    selectedRange,
    customStartDate,
    customEndDate,
    sortBy,
    sortOrder,
    effectiveBranchId,
  ]);

  const syncOrdersSince = useCallback(async () => {
    if (!navigator.onLine) return;
    const since = (await getSessionValue('orders_last_sync')) || null;
    let nextSince = since || new Date(0).toISOString();
    let receivedTotal = 0;
    try {
      while (true) {
        const res = await api.get('/orders', {
          params: { since: nextSince, limit: ORDER_CACHE_PAGE_SIZE, sort_by: 'created_at', sort_order: 'asc' },
        });
        const payload = res?.data || {};
        const list = Array.isArray(payload.orders) ? payload.orders : [];
        if (list.length === 0) break;
        await upsertOrders(list);
        receivedTotal += list.length;
        if (payload.sync?.next_since) {
          nextSince = payload.sync.next_since;
        } else {
          nextSince = list[list.length - 1]?.created_at || nextSince;
        }
        if (list.length < ORDER_CACHE_PAGE_SIZE) break;
      }
    } catch {
      // ignore sync errors
    } finally {
      if (receivedTotal > 0) {
        await saveSessionValue('orders_last_sync', nextSince);
      } else if (!since) {
        await saveSessionValue('orders_last_sync', nextSince);
      }
    }
  }, [ORDER_CACHE_PAGE_SIZE]);

  const fetchOrdersFromServer = useCallback(async () => {
    if (selectedRange === 'custom' && (!customStartDate || !customEndDate)) {
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    try {
      if (!navigator.onLine) {
        await loadCachedOrders();
        return;
      }
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

      const totalRecords = Number(payload.pagination?.total_records || 0);
      const currentPage = Number(payload.pagination?.page || pagination.page);
      const pageOrders = Array.isArray(payload.orders) ? payload.orders : [];
      if (totalRecords > ORDER_CACHE_FULL_SYNC_LIMIT) {
        if (currentPage === 1) {
          replaceAllOrders(pageOrders).catch(() => {});
          saveSessionValue('orders_last_sync', new Date().toISOString()).catch(() => {});
        }
      } else {
        upsertOrders(pageOrders).catch(() => {});
        if (!cacheSyncRef.current && !searchQuery) {
          cacheSyncRef.current = true;
          (async () => {
            try {
              await syncOrdersSince();
            } finally {
              cacheSyncRef.current = false;
            }
          })();
        }
      }
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
  }, [buildRangeParams, customEndDate, customStartDate, navigate, selectedRange, showPopup, loadCachedOrders, pagination.page, ORDER_CACHE_FULL_SYNC_LIMIT, ORDER_CACHE_PAGE_SIZE, searchQuery, syncOrdersSince]);

  const fetchOrders = useCallback(async () => {
    if (selectedRange === 'custom' && (!customStartDate || !customEndDate)) {
      return;
    }
    setIsLoading(true);
    setErrorMessage('');
    try {
      await loadCachedOrders();
    } finally {
      setIsLoading(false);
    }
  }, [customEndDate, customStartDate, loadCachedOrders, selectedRange]);

  useEffect(() => {
    loadCachedOrders();
  }, [loadCachedOrders, customRangeKey]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders, customRangeKey]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchOrders();
  }, [selectedBranchId, fetchOrders]);

  useEffect(() => {
    const handleOrdersCacheUpdated = () => {
      loadCachedOrders();
    };
    const handleOrdersSyncRequired = () => {
      if (!navigator.onLine) return;
      syncOrdersSince().finally(() => {
        loadCachedOrders();
      });
    };
    window.addEventListener('orders-cache-updated', handleOrdersCacheUpdated);
    window.addEventListener('orders-sync-required', handleOrdersSyncRequired);
    return () => {
      window.removeEventListener('orders-cache-updated', handleOrdersCacheUpdated);
      window.removeEventListener('orders-sync-required', handleOrdersSyncRequired);
    };
  }, [loadCachedOrders, syncOrdersSince]);

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
      const cached = await getCachedOrderDetails(orderId);
      const hasCachedItems = Array.isArray(cached?.items) && cached.items.length > 0;
      if (cached) {
        setDrawerOrder(cached);
      }

      const shouldFallback = !cached || !hasCachedItems;
      if (!shouldFallback) {
        if (gstInvoiceEnabled && !shopDetails && !shopDetailsLoading && navigator.onLine) {
          setShopDetailsLoading(true);
          try {
            const shopRes = await api.get('/shop-details/me');
            const shopPayload = shopRes?.data?.shop_details || shopRes?.data?.data || shopRes?.data || {};
            setShopDetails(shopPayload);
          } catch (innerErr) {
            console.error('Failed to load shop details', innerErr);
          } finally {
            setShopDetailsLoading(false);
          }
        }
        return;
      }

      if (!navigator.onLine) {
        setDrawerError('Order details not available offline.');
        return;
      }

      const res = await api.get(`/orders/${orderId}`);
      const payload = res?.data || {};
      setCustomerDetailsEnabled(Boolean(payload.customer_details_enabled));
      const serverOrder = payload.order || payload;
      setDrawerOrder(serverOrder);

      const serverItems =
        serverOrder?.items ||
        serverOrder?.products ||
        payload.items ||
        payload.products ||
        [];
      const serverPayments =
        serverOrder?.payment_history ||
        serverOrder?.payments ||
        payload.payment_history ||
        payload.payments ||
        [];
      upsertOrderDetailsCache({
        order: serverOrder,
        items: serverItems,
        payments: serverPayments,
      }).catch(() => {});

      if (gstInvoiceEnabled && !shopDetails && !shopDetailsLoading) {
        setShopDetailsLoading(true);
        try {
          const shopRes = await api.get('/shop-details/me');
          const shopPayload = shopRes?.data?.shop_details || shopRes?.data?.data || shopRes?.data || {};
          setShopDetails(shopPayload);
        } catch (innerErr) {
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
    setPaymentAmount('');
  };

  useEffect(() => {
    if (!drawerOrder?.id) return;
    const total = Number(drawerOrder.total_amount || 0);
    const paid = Number(drawerOrder.total_paid || 0);
    const returned = Number(drawerOrder.returned_amount || 0);
    const balance = Math.max(total - paid - returned, 0);
    setPaymentAmount(balance > 0 ? balance.toFixed(2) : '');
  }, [drawerOrder?.id]);

  const buildReturnItems = (order) => {
    const items = Array.isArray(order?.items)
      ? order.items
      : Array.isArray(order?.products)
        ? order.products
        : [];
    return items.map((item, idx) => {
      const soldQty = Number(item?.quantity ?? item?.qty ?? 0);
      const returnedQty = Number(item?.returned_quantity ?? item?.returned_qty ?? 0);
      const remainingQty = Math.max(soldQty - returnedQty, 0);
      const lineTotal = Number(item?.line_total ?? 0);
      const baseUnitPrice =
        soldQty > 0 && Number.isFinite(lineTotal)
          ? lineTotal / soldQty
          : Number(item?.selling_price ?? item?.price ?? 0);
      return {
        key: item?.product_id ?? item?.id ?? `${idx}`,
        product_id: item?.product_id ?? item?.id,
        product_name: item?.product_name || item?.name || '-',
        sold_qty: soldQty,
        returned_qty: returnedQty,
        remaining_qty: remainingQty,
        unit_price: baseUnitPrice,
        line_total: lineTotal,
        is_weight_based: item?.is_weight_based === 1 || item?.is_weight_based === true,
        return_qty: '',
      };
    });
  };

  const resetReturnState = () => {
    setReturnModalOpen(false);
    setReturnLoading(false);
    setReturnSubmitting(false);
    setReturnError('');
    setReturnOrder(null);
    setReturnItems([]);
    setReturnReason('Damaged');
    setRefundMode('cash');
  };

  const openReturnModal = async (event, orderId) => {
    if (event) {
      event.stopPropagation();
    }
    if (!orderId) return;
    setReturnModalOpen(true);
    setReturnLoading(true);
    setReturnError('');
    try {
      let orderData = null;
      if (drawerOrder?.id === orderId) {
        orderData = drawerOrder;
      } else {
        orderData = await getCachedOrderDetails(orderId);
      }
      if (!orderData && navigator.onLine) {
        const res = await api.get(`/orders/${orderId}`);
        orderData = res?.data?.order || res?.data || null;
      }
      if (!orderData && !navigator.onLine) {
        showPopup('Return requires an internet connection.', 'Offline');
        throw new Error('Order not available offline');
      }
      if (!orderData) {
        throw new Error('Order not found.');
      }
      const items = buildReturnItems(orderData);
      const hasRemaining = items.some((item) => Number(item.remaining_qty || 0) > 0);
      if (!hasRemaining) {
        showPopup('All items from this order are already returned.', 'Info');
        resetReturnState();
        return;
      }
      setReturnOrder(orderData);
      setReturnItems(items);
    } catch (err) {
      setReturnError('Unable to load return details.');
    } finally {
      setReturnLoading(false);
    }
  };

  const closeReturnModal = () => {
    resetReturnState();
  };

  const handleReturnQtyChange = (index, value) => {
    setReturnItems((prev) => {
      const next = [...prev];
      const current = next[index];
      if (!current) return prev;
      const trimmed = String(value ?? '').trim();
      if (trimmed === '') {
        next[index] = { ...current, return_qty: '' };
        return next;
      }
      const numeric = Number(trimmed);
      if (!Number.isFinite(numeric) || numeric < 0) {
        return prev;
      }
      const remaining = Number(current.remaining_qty || 0);
      if (numeric > remaining) {
        next[index] = { ...current, return_qty: String(remaining) };
        return next;
      }
      next[index] = { ...current, return_qty: trimmed };
      return next;
    });
  };

  const returnSummary = useMemo(() => {
    const totalQty = returnItems.reduce((sum, item) => sum + Number(item.sold_qty || 0), 0);
    const itemsLineTotal = returnItems.reduce((sum, item) => sum + Number(item.line_total || 0), 0);
    const orderTotal = Number(returnOrder?.total_amount || 0);
    const extraDiscount = Math.max(itemsLineTotal - orderTotal, 0);
    const discountPerUnit = totalQty > 0 ? extraDiscount / totalQty : 0;
    let itemsRefund = 0;
    let discountAdjust = 0;
    returnItems.forEach((item) => {
      const qty = Number(item.return_qty || 0);
      const unitPrice = Number(item.unit_price || 0);
      if (!Number.isFinite(qty) || qty <= 0) return;
      itemsRefund += qty * unitPrice;
      discountAdjust += qty * discountPerUnit;
    });
    const finalRefund = Math.max(itemsRefund - discountAdjust, 0);
    return { itemsRefund, discountAdjust, finalRefund, discountPerUnit };
  }, [returnItems, returnOrder]);

  const handleProcessReturn = async () => {
    if (!returnOrder?.id || returnSubmitting) return;
    if (!returnReason) {
      showPopup('Select a return reason.', 'Validation');
      return;
    }
    if (!refundMode) {
      showPopup('Select a refund mode.', 'Validation');
      return;
    }
    const payloadItems = returnItems
      .map((item) => ({
        productId: item.product_id,
        quantity: Number(item.return_qty || 0),
        unitPrice: Number(item.unit_price || 0),
        remaining: Number(item.remaining_qty || 0),
      }))
      .filter((item) => Number.isFinite(item.quantity) && item.quantity > 0);

    if (payloadItems.length === 0) {
      showPopup('Enter a return quantity for at least one item.', 'Validation');
      return;
    }

    const invalidItem = payloadItems.find((item) => item.quantity > item.remaining);
    if (invalidItem) {
      showPopup('Return quantity cannot exceed remaining quantity.', 'Validation');
      return;
    }

    try {
      setReturnSubmitting(true);
      await api.post(`/orders/${returnOrder.id}/returns`, {
        items: payloadItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        reason: returnReason,
        refundMode: refundMode,
      });
      showPopup('Return processed successfully.', 'Success');
      closeReturnModal();
      fetchOrdersFromServer();
      if (drawerOpen && drawerOrder?.id === returnOrder.id) {
        fetchOrderDetails(returnOrder.id);
      }
    } catch (err) {
      const message = err?.response?.data?.message || 'Failed to process return.';
      setReturnError(message);
      showPopup(message, 'Error');
    } finally {
      setReturnSubmitting(false);
    }
  };

  const handleRangeChange = (value) => {
    setSelectedRange(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleForceResync = async () => {
    try {
      await clearOrdersCache();
      await saveSessionValue('orders_last_sync', new Date(0).toISOString());
      await loadCachedOrders();
      await fetchOrdersFromServer();
      showPopup('Orders resync started.', 'Success');
    } catch {
      showPopup('Unable to start resync.', 'Error');
    }
  };

  const handleRefreshFromServer = async () => {
    if (!navigator.onLine) {
      showPopup('You are offline. Please connect to refresh from server.', 'Offline');
      return;
    }
    try {
      await fetchOrdersFromServer();
      showPopup('Orders refreshed from server.', 'Success');
    } catch {
      showPopup('Unable to refresh orders.', 'Error');
    }
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
      const balance = Number(order.balance ?? 0);
      const parsedAmount = Number(paymentAmount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        showPopup('Enter a valid payment amount', 'Validation');
        return;
      }
      if (Number.isFinite(balance) && parsedAmount > balance) {
        showPopup('Payment amount exceeds balance', 'Validation');
        return;
      }
      const currentOrder = (await getCachedOrderById(order.id)) || order;
      const totalPaid = Number(currentOrder?.total_paid || 0) + parsedAmount;
      const totalAmount = Number(currentOrder?.total_amount || 0);
      const returnedAmount = Number(currentOrder?.returned_amount || 0);
      const nextBalance = Math.max(totalAmount - totalPaid - returnedAmount, 0);
      const nextStatus = nextBalance <= 0 ? 'paid' : 'partial';
      const updatedOrder = {
        ...currentOrder,
        total_paid: totalPaid,
        balance: nextBalance,
        payment_status: nextStatus,
        payment_mode: paymentMode,
      };

      const localTxn = {
        id: generateLocalTxnId(),
        order_id: currentOrder?.id ?? order.id,
        amount: parsedAmount,
        payment_mode: paymentMode,
        created_at: new Date().toISOString(),
        txn_type: 'payment',
        direction: 'in',
      };

      await upsertOrders([updatedOrder]);
      await saveTransactionsBulk([localTxn]);

      setOrders((prev) =>
        prev.map((row) => (row.id === updatedOrder.id ? { ...row, ...updatedOrder } : row))
      );
      if (drawerOpen && drawerOrder?.id === updatedOrder.id) {
        const existingPayments = await getCachedOrderTransactions(updatedOrder.id);
        const mergedPayments = existingPayments.some((p) => p?.id === localTxn.id)
          ? existingPayments
          : [...existingPayments, localTxn];
        setDrawerOrder((prev) => ({
          ...prev,
          ...updatedOrder,
          payment_history: mergedPayments,
        }));
      }

      if (!navigator.onLine) {
        await enqueueOfflineOrder({
          type: 'mark-paid',
          orderId: updatedOrder.id,
          payload: {
            order_id: updatedOrder.id,
            payment_mode: paymentMode,
            amount_paid: parsedAmount,
          },
        });
        showPopup('Saved Offline', 'Offline');
        return;
      }

      await api.post('/orders/mark-paid', {
        order_id: updatedOrder.id,
        payment_mode: paymentMode,
        amount_paid: parsedAmount,
      });
    } catch (err) {
        if (err.response?.data?.message === 'Invalid Token' || err.response?.status === 401) {
          showPopup('Token Expired Please Login Again!', 'Session');
          navigate('/logout');
          return;
        }
      if (!err.response && !navigator.onLine) {
        showPopup('Saved Offline', 'Offline');
        return;
      }
      showPopup('Failed to mark order as paid.', 'Error');
    } finally {
      setPaymentSubmittingId((current) => (current === order.id ? null : current));
    }
  };

  const openGstModal = () => {
    if (!drawerOrder) return;
    const gstEnabledForOrder =
      drawerOrder?.is_gst_enabled === true || drawerOrder?.gst_enabled === true;
    if (!gstEnabledForOrder) return;
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

  const resolveOrderPhone = (order) =>
    order?.customer_phone ||
    order?.customer_mobile ||
    order?.customerMobile ||
    order?.customerPhone ||
    '';

  const handleWhatsAppSend = async (phoneValue, orderId) => {
    const resolvedOrderId = orderId || selectedOrderId;
    if (!resolvedOrderId) return;
    try {
      setWhatsappSending(true);
      await sendBillViaWhatsApp({ order_id: resolvedOrderId, phone: phoneValue });
      showPopup('Bill sent via WhatsApp.', 'Success');
      setWhatsappModalOpen(false);
      resetWhatsappState();
      setWhatsappTarget(null);
    } catch (err) {
      const message =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to send WhatsApp bill';
      showPopup(message, 'Error');
    } finally {
      setWhatsappSending(false);
    }
  };

  const openWhatsAppModal = (order) => {
    if (!order?.id) return;
    setWhatsappTarget(order);
    setSelectedOrderId(order.id);
    setWhatsappPhone(resolveOrderPhone(order));
    setWhatsappModalOpen(true);
  };

  const handleWhatsAppClick = (event, order) => {
    if (event) {
      event.stopPropagation();
    }
    if (!order?.id) return;
    const normalizedPhone = String(resolveOrderPhone(order) || '').replace(/\D+/g, '');
    if (normalizedPhone.length === 10) {
      handleWhatsAppSend(normalizedPhone, order.id);
      return;
    }
    openWhatsAppModal(order);
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

  const handleReceiptPrint = async () => {
    if (!receiptOrder) return;
    try {
      const printBase = process.env.REACT_APP_PRINT_SERVICE_URL || 'http://localhost:5000';
      const items = Array.isArray(receiptOrder?.items)
        ? receiptOrder.items
        : Array.isArray(receiptOrder?.products)
          ? receiptOrder.products
          : [];
      const normalizedItems = items.map((item) => ({
        name: item?.product_name || item?.name || '-',
        qty: Number(item?.quantity ?? item?.qty ?? 0),
        rate: Number(item?.price ?? item?.selling_price ?? 0),
      }));
      const subtotal =
        Number(receiptOrder?.subtotal_amount ?? receiptOrder?.subtotal ?? 0) ||
        normalizedItems.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.rate || 0), 0);
      const gst =
        Number(receiptOrder?.gst_amount ?? receiptOrder?.gst ?? receiptOrder?.gst_total ?? 0) || 0;
      const discount = Number(receiptOrder?.discount ?? receiptOrder?.discount_amount ?? 0) || 0;
      const total =
        Number(receiptOrder?.total_amount ?? receiptOrder?.total ?? 0) ||
        subtotal + gst - discount;
      const createdAt = receiptOrder?.created_at || new Date().toISOString();
      const date = formatDate(createdAt);
      const time = new Date(createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${printBase}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billNo: receiptOrder?.id || '-',
          date,
          time,
          payment: receiptOrder?.payment_method || receiptOrder?.payment_mode || receiptOrder?.payment || 'CASH',
          items: normalizedItems,
          subtotal,
          gst,
          discount,
          total,
          shopName: shopDetails?.shop_name || shopDetails?.name || shopDetails?.business_name || 'Your Shop',
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || 'Print failed');
      }
      showPopup('Receipt printed successfully.', 'Success');
    } catch (err) {
      const message = err?.name === 'AbortError' ? 'Print timeout' : (err?.message || 'Print failed');
      showPopup(message, 'Error');
    }
  };

  const handlePrintAction = async (event, order) => {
    if (event) {
      event.stopPropagation();
    }
    if (!receiptModuleEnabled) {
      showPopup('Receipt module is not enabled for this tenant.', 'Print');
      return;
    }
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
      fetchOrdersFromServer();
    } catch (err) {
      showPopup('Failed to delete order', 'Error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleRowClick = (order) => {
    if (!order) return;
    const isLocalId = typeof order?.id === 'string' && order.id.startsWith('local:');
    const isPending = order?.is_offline === true || isLocalId;
    if (isPending) {
      showPopup('This order is pending sync. Please sync to view full details.', 'Pending Sync');
      return;
    }
    openDrawer(order.id);
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
    return sortOrder === 'asc' ? 'â–²' : 'â–¼';
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

  const isReturnEligible = (order) =>
    ['completed', 'partially_returned'].includes(order?.order_status);

  const renderPaymentCell = (order) => {
    const isLocalId = typeof order?.id === 'string' && order.id.startsWith('local:');
    const isPending = order?.is_offline === true || isLocalId;
    if (isPending) {
      return <span className="payment-badge pending">Pending Sync</span>;
    }
    const status = order.payment_status;
    const orderStatus = order.order_status || '';
    const isFullyReturned = orderStatus === 'fully_returned';
    const isPartiallyReturned = orderStatus === 'partially_returned';
    const returnBadge = isFullyReturned ? (
      <span className="payment-badge returned">Returned</span>
    ) : isPartiallyReturned ? (
      <span className="payment-badge partial-return">Partially Returned</span>
    ) : null;

    if (isFullyReturned) {
      return returnBadge;
    }

    if (status === 'paid') {
      return returnBadge || <span className="payment-badge paid">Completed</span>;
    }
    if (status === 'partial') {
      return (
        <div className="payment-cell">
          {returnBadge}
          <button
            className="payment-btn warning"
            onClick={(event) => handlePaymentAction(event, order)}
            disabled={paymentSubmittingId === order.id}
          >
            {paymentSubmittingId === order.id ? 'Saving...' : 'Pay Balance'}
          </button>
        </div>
      );
    }
    return (
      <div className="payment-cell">
        {returnBadge}
        <button
          className="payment-btn danger"
          onClick={(event) => handlePaymentAction(event, order)}
          disabled={paymentSubmittingId === order.id}
        >
          {paymentSubmittingId === order.id ? 'Saving...' : 'Make Payment'}
        </button>
      </div>
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
  const gstEnabledForOrder =
    drawerOrder?.is_gst_enabled === true || drawerOrder?.gst_enabled === true;

  const returnEnabled = false;
  const hasActions = receiptModuleEnabled || whatsappEnabled || returnEnabled;

  return (
    <div className="orders-page">
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
            <button
              className="btn btn-outline-secondary btn-sm"
              type="button"
              onClick={handleForceResync}
              disabled={isLoading}
            >
              Resync
            </button>
            <button
              className="btn btn-outline-secondary btn-sm"
              type="button"
              onClick={handleRefreshFromServer}
              disabled={isLoading}
            >
              Refresh from server
            </button>
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
                <th>GST</th>
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
                  <td><span className="skeleton-block" /></td>
                  {hasActions && <td><span className="skeleton-block" /></td>}
                </tr>
              ))}
              {!isLoading && errorMessage && (
                <tr>
                  <td colSpan={customerDetailsEnabled ? (hasActions ? 8 : 7) : (hasActions ? 7 : 6)} className="empty-state">{errorMessage}</td>
                </tr>
              )}
              {!isLoading && !errorMessage && orders.length === 0 && (
                <tr>
                  <td colSpan={customerDetailsEnabled ? (hasActions ? 8 : 7) : (hasActions ? 7 : 6)} className="empty-state">No orders found.</td>
                </tr>
              )}
              {!isLoading && !errorMessage && orders.map((order) => {
                const isLocalId = typeof order?.id === 'string' && order.id.startsWith('local:');
                const isPending = order?.is_offline === true || isLocalId;
                const orderIdRaw = order?.id;
                const orderIdText =
                  typeof orderIdRaw === 'string' && orderIdRaw.startsWith('local:')
                    ? 'LOCAL'
                    : orderIdRaw;
                const billingType = getBillingType(order);
                const isWholesale = billingType === 'wholesale';
                return (
                <tr
                  key={order.id}
                  className="orders-row"
                  onClick={() => handleRowClick(order)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      handleRowClick(order);
                    }
                  }}
                >
                  <td>
                    <span className="order-id-cell">
                      #{orderIdText}
                      {isWholesale && (
                        <span className="order-type-tag wholesale">Wholesale</span>
                      )}
                      {isPending && (
                        <i
                          className="bi bi-arrow-repeat sync-icon"
                          title="Pending sync"
                        />
                      )}
                    </span>
                  </td>
                  <td>{renderProductSummary(order)}</td>
                  {customerDetailsEnabled && <td>{order.customer_name || '-'}</td>}
                  <td>{formatMoney(order.total_amount)}</td>
                  <td>{order?.is_gst_enabled === true || order?.gst_enabled === true ? 'Yes' : 'No'}</td>
                  <td>{renderPaymentCell(order)}</td>
                  <td>{formatDate(order.created_at)}</td>
                  {hasActions && !isPending && (
                    <td>
                      {returnEnabled && isReturnEligible(order) && (
                        <button
                          className="btn btn-outline-warning btn-sm me-2"
                          type="button"
                          onClick={(event) => openReturnModal(event, order.id)}
                        >
                          Return
                        </button>
                      )}
                      {whatsappEnabled && (
                        <SendWhatsAppButton
                          onClick={(event) => handleWhatsAppClick(event, order)}
                          loading={whatsappSending && selectedOrderId === order.id}
                          className="btn btn-outline-success btn-sm me-2"
                          label="Send WhatsApp"
                        />
                      )}
                      {receiptModuleEnabled && (
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
              );
              })}
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
                      <span>Returned</span>
                      <strong>{formatMoney(drawerOrder.returned_amount || 0)}</strong>
                    </div>
                    <div>
                      <span>Balance</span>
                      <strong>{formatMoney(drawerOrder.balance)}</strong>
                    </div>
                    <div>
                      <span>Status</span>
                      <strong className="status-text">{drawerOrder.order_status || '-'}</strong>
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
                  {returnEnabled && isReturnEligible(drawerOrder) && (
                    <button
                      className="btn btn-outline-warning"
                      onClick={(event) => openReturnModal(event, drawerOrder?.id)}
                    >
                      Return Product
                    </button>
                  )}
                  {balance > 0 ? (
                    <>
                      <div className="payment-input-group">
                        <label>
                          Amount
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            min="0"
                            step="0.01"
                            value={paymentAmount}
                            onChange={(event) => setPaymentAmount(event.target.value)}
                          />
                        </label>
                        <small className="text-secondary">Balance: {formatMoney(balance)}</small>
                      </div>
                      <button
                        className="btn btn-primary"
                        onClick={(event) => handlePaymentAction(event, drawerOrder)}
                        disabled={paymentSubmittingId === drawerOrder?.id}
                      >
                        {paymentSubmittingId === drawerOrder?.id ? 'Saving...' : 'Add Payment'}
                      </button>
                    </>
                  ) : (
                    <span className="payment-badge paid">Fully Paid</span>
                  )}
                  {gstEnabledForOrder && (
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
                  )}
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
      {returnModalOpen && (
        <div className="return-modal-overlay" onClick={closeReturnModal}>
          <div className="return-modal" onClick={(event) => event.stopPropagation()}>
            <h4>Return Products</h4>
            {returnLoading && <div className="return-loading">Loading return details...</div>}
            {!returnLoading && returnError && <div className="return-error">{returnError}</div>}
            {!returnLoading && !returnError && returnOrder && (
              <>
                <div className="return-table-wrapper">
                  <table className="return-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Sold Qty</th>
                        <th>Returned</th>
                        <th>Return Qty</th>
                        <th>Price</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returnItems.map((item, idx) => {
                        const qty = Number(item.return_qty || 0);
                        const amount = qty > 0 ? qty * Number(item.unit_price || 0) : 0;
                        return (
                          <tr key={`return-item-${item.product_id || idx}`}>
                            <td>{item.product_name}</td>
                            <td>{item.sold_qty}</td>
                            <td>{item.returned_qty}</td>
                            <td>
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                value={item.return_qty}
                                min={0}
                                max={item.remaining_qty}
                                step={item.is_weight_based ? '0.01' : '1'}
                                disabled={Number(item.remaining_qty || 0) <= 0}
                                onChange={(event) => handleReturnQtyChange(idx, event.target.value)}
                              />
                              <small className="text-secondary">Remaining: {item.remaining_qty}</small>
                            </td>
                            <td>{formatMoney(item.unit_price)}</td>
                            <td>{formatMoney(amount)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="return-form">
                  <div className="return-form-field">
                    <label>Reason</label>
                    <select
                      className="form-select"
                      value={returnReason}
                      onChange={(event) => setReturnReason(event.target.value)}
                    >
                      {RETURN_REASONS.map((reason) => (
                        <option key={reason} value={reason}>{reason}</option>
                      ))}
                    </select>
                  </div>
                  <div className="return-form-field">
                    <label>Refund Mode</label>
                    <select
                      className="form-select"
                      value={refundMode}
                      onChange={(event) => setRefundMode(event.target.value)}
                    >
                      {REFUND_MODES.map((mode) => (
                        <option key={mode} value={mode}>{mode}</option>
                      ))}
                    </select>
                  </div>
                <div className="return-total">
                  <span>Items Refund</span>
                  <strong>{formatMoney(returnSummary.itemsRefund)}</strong>
                </div>
                {returnSummary.discountAdjust > 0 && (
                  <div className="return-total">
                    <span>Discount Adjustment</span>
                    <strong>-{formatMoney(returnSummary.discountAdjust)}</strong>
                  </div>
                )}
                <div className="return-total">
                  <span>Final Refund</span>
                  <strong>{formatMoney(returnSummary.finalRefund)}</strong>
                </div>
                {returnSummary.discountAdjust > 0 && (
                  <small className="text-secondary d-block">
                    Discount benefit will be adjusted on return.
                  </small>
                )}
                </div>
                <div className="return-actions">
                  <button className="btn btn-outline-secondary" onClick={closeReturnModal}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleProcessReturn}
                    disabled={returnSubmitting}
                  >
                    {returnSubmitting ? 'Processing...' : 'Process Return'}
                  </button>
                </div>
              </>
            )}
          </div>
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
      {gstModalOpen && gstEnabledForOrder && (
        <div className="delete-modal-overlay" onClick={closeGstModal}>
          <div className="delete-modal" onClick={(event) => event.stopPropagation()}>
            <h4>GST Invoice Details</h4>
            {shopDetails && (
              <p className="mb-2">
                <strong>{shopDetails.shop_name || shopDetails.name || shopDetails.business_name}</strong>
                {(shopDetails.gst_number || shopDetails.gstin || shopDetails.gstin_number) && (
                  <> Â· GST: {shopDetails.gst_number || shopDetails.gstin || shopDetails.gstin_number}</>
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
      <WhatsAppModal
        open={whatsappModalOpen}
        initialPhone={whatsappPhone}
        onClose={() => setWhatsappModalOpen(false)}
        onSubmit={(phoneValue) => handleWhatsAppSend(phoneValue, whatsappTarget?.id)}
      />
    </div>
  );
};

export default OrdersPage;

