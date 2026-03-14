import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import api from '../../utils/axios';
import MobileShell from '../components/MobileShell';
import MetricCard from '../components/MetricCard';
import SectionCard from '../components/SectionCard';

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const DashboardMobile = () => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchDashboard = async () => {
      try {
        const res = await api.get('/mobile/dashboard');
        if (active) {
          setDashboard(res.data);
        }
      } catch (err) {
        console.error('Failed to load mobile dashboard', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchDashboard();
    return () => {
      active = false;
    };
  }, []);

  return (
    <MobileShell
      title="Dashboard"
      subtitle="Today at a glance for quick decision making."
    >
      <div className="grid grid-cols-2 gap-4">
        <MetricCard
          label="Today Sales"
          value={loading ? '...' : `₹${formatCurrency(dashboard?.today_sales)}`}
          helper="Completed sales"
        />
        <MetricCard
          label="Orders Today"
          value={loading ? '...' : dashboard?.today_orders ?? 0}
          helper="All new orders"
        />
        <MetricCard
          label="Profit Today"
          value={loading ? '...' : `₹${formatCurrency(dashboard?.today_profit)}`}
          helper="Estimated"
        />
        <MetricCard
          label="Low Stock"
          value={loading ? '...' : dashboard?.low_stock_count ?? 0}
          helper="Needs attention"
        />
      </div>

      <SectionCard title="Recent Orders">
        {loading && <p className="text-sm text-white/60">Loading orders...</p>}
        {!loading && (dashboard?.recent_orders || []).length === 0 && (
          <p className="text-sm text-white/60">No recent orders.</p>
        )}
        {!loading &&
          (dashboard?.recent_orders || []).map((order) => (
            <div
              key={order.id}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-white">#{order.id}</p>
                <p className="text-xs text-white/60">
                  {dayjs(order.created_at).format('DD MMM, h:mm A')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-white">₹{formatCurrency(order.total)}</p>
                <p className="text-xs text-white/60">{order.items} items</p>
              </div>
            </div>
          ))}
      </SectionCard>
    </MobileShell>
  );
};

export default DashboardMobile;
