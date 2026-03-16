import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/axios';
import MobileShell from '../components/MobileShell';
import SectionCard from '../components/SectionCard';
import OrderItem from '../components/OrderItem';

const OrdersMobile = () => {
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

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
          limit: 10
        }
      });
      const payload = res.data || {};
      if (nextPage === 1) {
        setOrders(payload.orders || []);
      } else {
        setOrders((prev) => [...prev, ...(payload.orders || [])]);
      }
      setTotal(payload.total || 0);
      setPage(nextPage);
    } catch (err) {
      console.error('Failed to load mobile orders', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchOrders(1);
  }, []);

  const canLoadMore = orders.length < total;

  return (
    <MobileShell title="Orders" subtitle="Fast, lightweight view of recent orders.">
      <SectionCard title="Orders List">
        {loading && <p className="text-[12px] text-white/60">Loading orders...</p>}
        {!loading && orders.length === 0 && (
          <p className="text-[12px] text-white/60">No orders found.</p>
        )}
        {orders.map((order) => (
          <Link
            key={order.id}
            to={`/m/orders/${order.id}`}
            className="block"
          >
            <OrderItem order={order} />
          </Link>
        ))}
        {canLoadMore && (
          <button
            onClick={() => fetchOrders(page + 1)}
            disabled={loadingMore}
            className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-white/20 disabled:opacity-60"
          >
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        )}
      </SectionCard>
    </MobileShell>
  );
};

export default OrdersMobile;
