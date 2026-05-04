import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/axios';
import { getAllCustomers, upsertCustomersBulk } from '../../core/db';
import { getCachedOrderItems, getCachedOrdersByCustomer, upsertOrderDetailsCache } from '../../db/ordersDb';
import './Customers.css';

const toCustomerIdentity = (customer) => {
  const phone = String(customer?.phone || customer?.mobile || '').replace(/\D/g, '');
  const name = String(customer?.name || '').trim().toLowerCase();
  if (phone && name) return `phone:${phone}|name:${name}`;
  if (phone) return `phone:${phone}`;
  const id = String(customer?.id || '').trim();
  if (id) return `id:${id}`;
  return `name:${name}`;
};

const dedupeCustomers = (list) => {
  const safe = Array.isArray(list) ? list : [];
  const seen = new Set();
  return safe.filter((customer) => {
    const key = toCustomerIdentity(customer);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const toMoney = (value) => {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toFixed(2) : '0.00';
};

const getOrderItemProductId = (item) =>
  item?.product_id ?? item?.productId ?? item?.id ?? item?.barcode ?? null;

const resolveOrderTotal = (order) => {
  if (!order || typeof order !== 'object') return 0;
  const directCandidates = [
    order.total_price,
    order.total_amount,
    order.grand_total,
    order.net_amount,
    order.final_amount,
    order.amount,
  ];
  for (const candidate of directCandidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) return value;
  }

  const subtotal = Number(order.subtotal ?? order.subtotal_amount ?? 0);
  const gst = Number(order.gst_total ?? order.tax_amount ?? order.tax_total ?? 0);
  const discount = Number(order.discount ?? order.discount_amount ?? 0);
  const computed = subtotal + gst - discount;
  return Number.isFinite(computed) && computed > 0 ? computed : 0;
};

const isSyncedServerCustomerId = (value) => {
  const text = String(value || '').trim();
  if (!text) return false;
  const lowered = text.toLowerCase();
  if (
    lowered.startsWith('temp:') ||
    lowered.startsWith('temp_') ||
    lowered.startsWith('local:') ||
    lowered.startsWith('local_') ||
    lowered.startsWith('tmp:')
  ) {
    return false;
  }
  return Number.isFinite(Number(text));
};

const CustomerReorder = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderItems, setOrderItems] = useState([]);
  const [selectedProductIds, setSelectedProductIds] = useState(new Set());
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingOrderItems, setLoadingOrderItems] = useState(false);
  const [error, setError] = useState('');
  const searchTimerRef = useRef(null);

  const filterLocalCustomers = useCallback((list, term) => {
    const needle = String(term || '').trim().toLowerCase();
    if (!needle) return list;
    return list.filter((customer) => {
      const name = String(customer?.name || '').toLowerCase();
      const phone = String(customer?.phone || customer?.mobile || '').toLowerCase();
      const shop = String(customer?.shop_name || '').toLowerCase();
      return name.includes(needle) || phone.includes(needle) || shop.includes(needle);
    });
  }, []);

  const loadCustomersFromCache = useCallback(async (term = '') => {
    const list = await getAllCustomers();
    const safe = dedupeCustomers(list);
    setCustomers(filterLocalCustomers(safe, term));
  }, [filterLocalCustomers]);

  const fetchCustomers = useCallback(async (term = '') => {
    setLoadingCustomers(true);
    try {
      const cachedList = dedupeCustomers(await getAllCustomers());
      const filteredCached = filterLocalCustomers(cachedList, term);
      setCustomers(filteredCached);
      if (filteredCached.length || !navigator.onLine) return;
      const res = await api.get('/customers', {
        params: term ? { search: term } : { limit: 500 },
      });
      const list = res?.data?.data?.customers || res?.data?.customers || [];
      const safe = dedupeCustomers(list);
      if (safe.length) {
        setCustomers(filterLocalCustomers(safe, term));
        upsertCustomersBulk(safe).catch(() => {});
      }
    } catch {
      // keep cached list
    } finally {
      setLoadingCustomers(false);
    }
  }, [filterLocalCustomers]);

  const loadCustomerOrdersFromCache = useCallback(async (customer) => {
    if (!customer) return [];
    try {
      const cached = await getCachedOrdersByCustomer(customer);
      const list = Array.isArray(cached) ? cached : [];
      return list
        .slice()
        .sort((a, b) => String(b?.created_at || '').localeCompare(String(a?.created_at || '')));
    } catch {
      return [];
    }
  }, []);

  const loadOrderItemsFromCache = useCallback(async (orderId) => {
    if (!orderId) return [];
    try {
      const cached = await getCachedOrderItems(orderId);
      return Array.isArray(cached) ? cached : [];
    } catch {
      return [];
    }
  }, []);

  const loadOrdersForCustomer = useCallback(async (customer, { preferApi = true } = {}) => {
    const customerId = customer?.id;
    if (!customerId) return;
    setLoadingOrders(true);
    setError('');
    setOrders([]);
    setSelectedOrder(null);
    setOrderItems([]);
    setSelectedProductIds(new Set());
    try {
      const cachedOrders = await loadCustomerOrdersFromCache(customer);
      if (cachedOrders.length) {
        setOrders(cachedOrders);
      }
      const shouldFallbackToApi =
        !cachedOrders.length && preferApi && navigator.onLine && isSyncedServerCustomerId(customerId);
      if (!shouldFallbackToApi) {
        return;
      }
      const res = await api.get(`/customers/${customerId}`);
      const payload = res?.data?.data || res?.data || {};
      const apiOrders = Array.isArray(payload?.orders) ? payload.orders : [];
      if (apiOrders.length) {
        setOrders(apiOrders);
      } else if (!cachedOrders.length) {
        setOrders([]);
      }
    } catch (err) {
      const fallbackOrders = await loadCustomerOrdersFromCache(customer);
      if (fallbackOrders.length) {
        setOrders(fallbackOrders);
        setError('Showing cached orders (offline/local data).');
      } else {
        setError(err?.response?.data?.message || 'Failed to load customer orders.');
      }
    } finally {
      setLoadingOrders(false);
    }
  }, [loadCustomerOrdersFromCache]);

  const loadItemsForOrder = useCallback(async (order, { preferApi = false } = {}) => {
    const orderId = order?.id;
    if (!orderId) return;
    setLoadingOrderItems(true);
    setError('');
    setOrderItems([]);
    setSelectedProductIds(new Set());
    try {
      const cachedItems = await loadOrderItemsFromCache(orderId);
      if (cachedItems.length) {
        setOrderItems(cachedItems);
        setSelectedProductIds(new Set(cachedItems.map((item) => String(getOrderItemProductId(item)))));
        return;
      }

      const embeddedItems = Array.isArray(order?.items)
        ? order.items
        : Array.isArray(order?.products)
          ? order.products
          : [];
      if (embeddedItems.length) {
        setOrderItems(embeddedItems);
        setSelectedProductIds(new Set(embeddedItems.map((item) => String(getOrderItemProductId(item)))));
      }
      const shouldFallbackToApi =
        !cachedItems.length &&
        !embeddedItems.length &&
        preferApi &&
        navigator.onLine &&
        Number.isFinite(Number(orderId));
      if (!shouldFallbackToApi) {
        return;
      }
      const res = await api.get(`/orders/${orderId}`);
      const payload = res?.data || {};
      const fetchedOrder =
        payload?.order ||
        payload?.data?.order ||
        payload?.data ||
        {};
      const apiItems = Array.isArray(fetchedOrder?.items)
        ? fetchedOrder.items
        : Array.isArray(fetchedOrder?.products)
          ? fetchedOrder.products
          : Array.isArray(payload?.items)
            ? payload.items
            : Array.isArray(payload?.order_items)
              ? payload.order_items
              : Array.isArray(payload?.data?.items)
                ? payload.data.items
                : [];
      if (apiItems.length) {
        const payments = Array.isArray(fetchedOrder?.payment_history)
          ? fetchedOrder.payment_history
          : Array.isArray(fetchedOrder?.payments)
            ? fetchedOrder.payments
            : Array.isArray(payload?.payments)
              ? payload.payments
              : Array.isArray(payload?.transactions)
                ? payload.transactions
                : Array.isArray(payload?.data?.payments)
                  ? payload.data.payments
                  : [];
        const orderForCache = fetchedOrder?.id ? fetchedOrder : { ...order, ...fetchedOrder };
        upsertOrderDetailsCache({ order: orderForCache, items: apiItems, payments }).catch(() => {});
      }
      if (apiItems.length) {
        setOrderItems(apiItems);
        setSelectedProductIds(new Set(apiItems.map((item) => String(getOrderItemProductId(item)))));
      } else if (!cachedItems.length) {
        setOrderItems([]);
        setSelectedProductIds(new Set());
      }
    } catch (err) {
      const fallbackItems = await loadOrderItemsFromCache(orderId);
      if (fallbackItems.length) {
        setOrderItems(fallbackItems);
        setSelectedProductIds(new Set(fallbackItems.map((item) => String(getOrderItemProductId(item)))));
        setError('Showing cached order items (offline/local data).');
      } else {
        setError(err?.response?.data?.message || 'Failed to load order items.');
      }
    } finally {
      setLoadingOrderItems(false);
    }
  }, [loadOrderItemsFromCache]);

  useEffect(() => {
    setLoadingCustomers(true);
    loadCustomersFromCache('')
      .finally(() => setLoadingCustomers(false));
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [loadCustomersFromCache]);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const term = search.trim();
    searchTimerRef.current = setTimeout(() => {
      if (!term) {
        loadCustomersFromCache('');
        return;
      }
      fetchCustomers(term);
    }, 300);
  }, [search, fetchCustomers, loadCustomersFromCache]);

  const selectedItems = useMemo(
    () => orderItems.filter((item) => selectedProductIds.has(String(getOrderItemProductId(item)))),
    [orderItems, selectedProductIds]
  );

  const handleCustomerPick = (customer) => {
    setSelectedCustomer(customer || null);
    if (customer?.id) {
      loadOrdersForCustomer(customer, { preferApi: isSyncedServerCustomerId(customer.id) });
    } else {
      setOrders([]);
      setSelectedOrder(null);
      setOrderItems([]);
      setSelectedProductIds(new Set());
    }
  };

  const handleOrderPick = (order) => {
    setSelectedOrder(order || null);
    if (order?.id) {
      loadItemsForOrder(order, { preferApi: true });
    } else {
      setOrderItems([]);
      setSelectedProductIds(new Set());
    }
  };

  const toggleProductSelection = (productId) => {
    const key = String(productId);
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleStartReorder = () => {
    if (!selectedCustomer?.id || !selectedOrder?.id || !selectedItems.length) return;
    const reorderProducts = selectedItems.map((item) => {
      const productId = getOrderItemProductId(item);
      return {
      id: productId,
      product_id: productId,
      product_name: item.product_name || '',
      quantity: String(item.remaining_quantity ?? item.quantity ?? 1),
      selling_price: String(item.selling_price ?? 0),
      purchase_price: String(item.purchase_price_snapshot ?? 0),
      gst_percentage: Number(item.gst_percent || 0),
      is_weight_based: item.is_weight_based ? 1 : 0,
      suggestions: [],
    };
    }).filter((item) => item.product_id !== null && item.product_id !== undefined && String(item.product_id).trim() !== '');

    navigate('/billing/retail', {
      state: {
        reorderPrefill: {
          prefillId: `reorder:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
          sourceOrderId: selectedOrder.id,
          customer: {
            id: selectedCustomer.id,
            name: selectedCustomer.name || '',
            phone: selectedCustomer.phone || selectedCustomer.mobile || '',
            address: selectedCustomer.address || '',
            location: selectedCustomer.location || '',
          },
          products: reorderProducts,
        },
      },
    });
  };

  return (
    <div className="billing-page customers-page">
      <div className="customers-header">
        <h3>Customer Reorder</h3>
        <div className="customers-search">
          <input
            className="form-control form-control-sm billing-input"
            placeholder="Search customer by name or phone"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button className="btn btn-outline-secondary" onClick={() => navigate('/customers')}>
            Back to Customers
          </button>
        </div>
      </div>

      {error && <div className="billing-error mb-2">{error}</div>}

      <div className="reorder-grid">
        <div className="reorder-panel">
          <h5>Select Customer</h5>
          {loadingCustomers && <div className="billing-empty">Loading customers...</div>}
          {!loadingCustomers && customers.length === 0 && (
            <div className="billing-empty">No customers found.</div>
          )}
          {!loadingCustomers && customers.length > 0 && (
            <div className="reorder-list">
              {customers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  className={`reorder-list-item ${
                    String(selectedCustomer?.id) === String(customer.id) ? 'active' : ''
                  }`}
                  onClick={() => handleCustomerPick(customer)}
                  title={
                    isSyncedServerCustomerId(customer?.id)
                      ? ''
                      : 'This customer is local/offline and not yet synced'
                  }
                >
                  <span className="title">{customer.name || 'Unnamed Customer'}</span>
                  <span className="meta">
                    {customer.phone || customer.mobile || '-'}
                    {!isSyncedServerCustomerId(customer?.id) ? ' | Pending Sync' : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="reorder-panel">
          <h5>Select Past Order</h5>
          {loadingOrders && <div className="billing-empty">Loading orders...</div>}
          {!loadingOrders && selectedCustomer && orders.length === 0 && (
            <div className="billing-empty">No order history for selected customer.</div>
          )}
          {!loadingOrders && !selectedCustomer && (
            <div className="billing-empty">Pick a customer first.</div>
          )}
          {!loadingOrders && orders.length > 0 && (
            <div className="reorder-list">
              {orders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  className={`reorder-list-item ${
                    String(selectedOrder?.id) === String(order.id) ? 'active' : ''
                  }`}
                  onClick={() => handleOrderPick(order)}
                >
                  <span className="title">Order #{order.id}</span>
                  <span className="meta">
                    INR {toMoney(resolveOrderTotal(order))} | {formatDateTime(order.created_at)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="reorder-panel">
          <h5>Select Items To Reorder</h5>
          {loadingOrderItems && <div className="billing-empty">Loading order items...</div>}
          {!loadingOrderItems && selectedOrder && orderItems.length === 0 && (
            <div className="billing-empty">No items found for selected order.</div>
          )}
          {!loadingOrderItems && !selectedOrder && (
            <div className="billing-empty">Pick an order first.</div>
          )}
          {!loadingOrderItems && orderItems.length > 0 && (
            <>
              <div className="reorder-list">
                {orderItems.map((item) => {
                  const productId = getOrderItemProductId(item);
                  const checked = selectedProductIds.has(String(productId));
                  return (
                    <label
                      key={`${String(productId)}:${String(item.product_name || item.name || '')}`}
                      className={`reorder-check-item ${checked ? 'active' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleProductSelection(productId)}
                      />
                      <span className="title">{item.product_name || item.name || 'Unnamed Item'}</span>
                      <span className="meta">
                        Qty {item.remaining_quantity ?? item.quantity} | INR {toMoney(item.selling_price)}
                      </span>
                    </label>
                  );
                })}
              </div>
              <button
                type="button"
                className="btn btn-primary mt-2"
                disabled={!selectedItems.length}
                onClick={handleStartReorder}
              >
                Start Reorder ({selectedItems.length} item{selectedItems.length > 1 ? 's' : ''})
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerReorder;
