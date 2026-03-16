import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../utils/axios';
import MobileShell from '../components/MobileShell';
import SectionCard from '../components/SectionCard';

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const OrderDetailsMobile = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchOrder = async () => {
      try {
        const res = await api.get(`/orders/${id}`, { params: { view: 'mobile' } });
        if (active) {
          setOrder(res.data);
        }
      } catch (err) {
        console.error('Failed to load mobile order detail', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchOrder();
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <MobileShell title={`Order #${id}`} subtitle="Quick order view for mobile.">
      <SectionCard title="Summary">
        {loading && <p className="text-[12px] text-white/60">Loading...</p>}
        {!loading && !order && <p className="text-[12px] text-white/60">Order not found.</p>}
        {!loading && order && (
          <div className="space-y-2 text-[12px] text-white/80">
            <div className="flex items-center justify-between">
              <span>Status</span>
              <span className="font-semibold text-white">{order.status}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Subtotal</span>
              <span className="font-semibold text-white">₹{formatCurrency(order.total)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Total</span>
              <span className="font-semibold text-white">₹{formatCurrency(order.total)}</span>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Items">
        {!loading && order?.items?.length === 0 && (
          <p className="text-[12px] text-white/60">No items for this order.</p>
        )}
        {!loading &&
          order?.items?.map((item, index) => (
            <div
              key={`${item.product_name}-${index}`}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5"
            >
              <div>
                <p className="text-[13px] font-semibold text-white">{item.product_name}</p>
                <p className="text-[11px] text-white/60">Qty {item.quantity}</p>
              </div>
              <p className="text-[11px] text-white/60">
                {item.quantity} x ₹{formatCurrency(item.price)}
              </p>
            </div>
          ))}
      </SectionCard>
    </MobileShell>
  );
};

export default OrderDetailsMobile;
