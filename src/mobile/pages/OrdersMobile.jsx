import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../utils/axios';
import MobileShell from '../components/MobileShell';
import SectionCard from '../components/SectionCard';
import OrderItem from '../components/OrderItem';
import SearchBar from '../components/SearchBar';

const normalizePayment = (order) => String(order?.payment_mode || order?.paymentMode || order?.payment || 'unknown').toLowerCase();

const OrdersMobile = () => {
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchOrders = async (nextPage = 1) => {
    if (nextPage === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const res = await api.get('/orders', {
        params: {
          view: 'mobile',
          page: nextPage,
          limit: 12,
        },
      });
      const payload = res.data || {};
      const nextOrders = payload.orders || [];
      if (nextPage === 1) {
        setOrders(nextOrders);
      } else {
        setOrders((prev) => [...prev, ...nextOrders]);
      }
      setTotal(payload.total || 0);
      setPage(nextPage);
    } catch {
      if (nextPage === 1) {
        setOrders([]);
        setTotal(0);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchOrders(1);
  }, []);

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((order) => {
      const statusText = String(order?.status || '').toLowerCase();
      const paymentText = normalizePayment(order);
      const orderDate = dayjs(order?.created_at || order?.createdAt);
      const matchesQuery =
        !q ||
        String(order?.id || '').toLowerCase().includes(q) ||
        String(order?.customer_name || order?.customer?.name || '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || statusText === statusFilter;
      const matchesPayment = paymentFilter === 'all' || paymentText.includes(paymentFilter);
      const matchesFrom = !fromDate || orderDate.isAfter(dayjs(fromDate).subtract(1, 'day'));
      const matchesTo = !toDate || orderDate.isBefore(dayjs(toDate).add(1, 'day'));
      return matchesQuery && matchesStatus && matchesPayment && matchesFrom && matchesTo;
    });
  }, [orders, paymentFilter, query, statusFilter, fromDate, toDate]);

  const canLoadMore = orders.length < total;

  return (
    <MobileShell title="Orders" subtitle="Track status, payment, and customer details with smart filters.">
      <SectionCard title="Find Orders">
        <SearchBar value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by order id or customer" />
        <div className="mobile-inline-grid">
          <div>
            <label className="mobile-label">Status</label>
            <select className="mobile-field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="processing">Processing</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="mobile-label">Payment</label>
            <select className="mobile-field" value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
              <option value="all">All modes</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="upi">UPI</option>
            </select>
          </div>
        </div>
        <div className="mobile-inline-grid">
          <div>
            <label className="mobile-label">From Date</label>
            <input type="date" className="mobile-field" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </div>
          <div>
            <label className="mobile-label">To Date</label>
            <input type="date" className="mobile-field" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Orders List" action={<span className="mobile-chip">Showing {filteredOrders.length}</span>}>
        {loading && <p className="mobile-muted" style={{ margin: 0, fontSize: 12 }}>Loading orders...</p>}
        {!loading && filteredOrders.length === 0 && (
          <p className="mobile-muted" style={{ margin: 0, fontSize: 12 }}>No orders match your filters.</p>
        )}

        {filteredOrders.map((order) => (
          <Link key={order.id} to={`/m/orders/${order.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <OrderItem order={order} />
          </Link>
        ))}

        {canLoadMore && (
          <button type="button" onClick={() => fetchOrders(page + 1)} disabled={loadingMore} className="mobile-button secondary">
            {loadingMore ? 'Loading more...' : 'Load More Orders'}
          </button>
        )}
      </SectionCard>
    </MobileShell>
  );
};

export default OrdersMobile;
