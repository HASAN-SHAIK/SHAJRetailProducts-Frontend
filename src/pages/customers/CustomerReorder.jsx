import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/axios';
import { getAllCustomers, upsertCustomersBulk } from '../../core/db';
import './Customers.css';

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
    const safe = Array.isArray(list) ? list : [];
    setCustomers(filterLocalCustomers(safe, term));
  }, [filterLocalCustomers]);

  const fetchCustomers = useCallback(async (term = '') => {
    setLoadingCustomers(true);
    try {
      await loadCustomersFromCache(term);
      if (!navigator.onLine) return;
      const res = await api.get('/customers', {
        params: term ? { search: term } : { limit: 500 },
      });
      const list = res?.data?.data?.customers || res?.data?.customers || [];
      const safe = Array.isArray(list) ? list : [];
      if (safe.length) {
        setCustomers(filterLocalCustomers(safe, term));
        upsertCustomersBulk(safe).catch(() => {});
      }
    } catch {
      // keep cached list
    } finally {
      setLoadingCustomers(false);
    }
  }, [filterLocalCustomers, loadCustomersFromCache]);

  const fetchCustomerOrders = async (customerId) => {
    if (!customerId) return;
    setLoadingOrders(true);
    setError('');
    setOrders([]);
    setSelectedOrder(null);
    setOrderItems([]);
    setSelectedProductIds(new Set());
    try {
      const res = await api.get(`/customers/${customerId}`);
      const payload = res?.data?.data || res?.data || {};
      const list = Array.isArray(payload?.orders) ? payload.orders : [];
      setOrders(list);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load customer orders.');
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchOrderItems = async (orderId) => {
    if (!orderId) return;
    setLoadingOrderItems(true);
    setError('');
    setOrderItems([]);
    setSelectedProductIds(new Set());
    try {
      const res = await api.get(`/orders/${orderId}`);
      const order = res?.data?.order || {};
      const items = Array.isArray(order?.items) ? order.items : [];
      setOrderItems(items);
      setSelectedProductIds(new Set(items.map((item) => String(item.product_id))));
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load order items.');
    } finally {
      setLoadingOrderItems(false);
    }
  };

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
    () => orderItems.filter((item) => selectedProductIds.has(String(item.product_id))),
    [orderItems, selectedProductIds]
  );

  const handleCustomerPick = (customer) => {
    setSelectedCustomer(customer || null);
    if (customer?.id) {
      fetchCustomerOrders(customer.id);
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
      fetchOrderItems(order.id);
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
    const reorderProducts = selectedItems.map((item) => ({
      id: item.product_id,
      product_id: item.product_id,
      product_name: item.product_name || '',
      quantity: String(item.remaining_quantity ?? item.quantity ?? 1),
      selling_price: String(item.selling_price ?? 0),
      purchase_price: String(item.purchase_price_snapshot ?? 0),
      gst_percentage: Number(item.gst_percent || 0),
      is_weight_based: item.is_weight_based ? 1 : 0,
      suggestions: [],
    }));

    navigate('/orders/create', {
      state: {
        reorderPrefill: {
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
                >
                  <span className="title">{customer.name || 'Unnamed Customer'}</span>
                  <span className="meta">{customer.phone || customer.mobile || '-'}</span>
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
                    INR {toMoney(order.total_price)} | {formatDateTime(order.created_at)}
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
                  const checked = selectedProductIds.has(String(item.product_id));
                  return (
                    <label key={item.product_id} className={`reorder-check-item ${checked ? 'active' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleProductSelection(item.product_id)}
                      />
                      <span className="title">{item.product_name}</span>
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
