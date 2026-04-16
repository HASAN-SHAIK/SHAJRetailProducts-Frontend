import { useEffect, useRef, useState } from 'react';
import { preloadProductsToIndexedDb } from '../../utils/indexedDb';
import api from '../../utils/axios';
import MobileShell from '../components/MobileShell';
import MetricCard from '../components/MetricCard';
import SectionCard from '../components/SectionCard';
import OrderItem from '../components/OrderItem';

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const DashboardMobile = () => {
  const preloadRef = useRef(false);
  useEffect(() => {
    console.log('[cacheDB] DashboardMobile mounted');
  }, []);

  useEffect(() => {
    console.log('[cacheDB] DashboardMobile preload check', { already: preloadRef.current });
    if (preloadRef.current) return;
    preloadRef.current = true;
    console.log('[cacheDB] DashboardMobile preload start');
    preloadProductsToIndexedDb()
      .then(() => console.log('[cacheDB] DashboardMobile preload success'))
      .catch((err) => {
        console.error('[cacheDB] DashboardMobile preload failed', err);
      });
  }, []);
  const [dashboard, setDashboard] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);

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

  useEffect(() => {
    let active = true;
    const fetchSummary = async () => {
      try {
        const res = await api.get('/mobile/sales-summary');
        if (active) {
          setSummary(res.data);
        }
      } catch (err) {
        console.error('Failed to load mobile sales summary', err);
      } finally {
        if (active) setSummaryLoading(false);
      }
    };
    fetchSummary();
    return () => {
      active = false;
    };
  }, []);

  return (
    <MobileShell
      // title="Dashboard"
      // subtitle="Today at a glance for quick decision making."
    >
      <div className="w-full max-w-md px-3">
        <div className="grid grid-cols-2 gap-2 text-center">
        <MetricCard
          label="Today Sales"
          value={loading ? '...' : `₹${formatCurrency(dashboard?.today_sales)}`}
          // helper="Completed sales"
        />
        <MetricCard
          label="Orders Today"
          value={loading ? '...' : dashboard?.today_orders ?? 0}
          // helper="All new orders"
        />
        <MetricCard
          label="Profit Today"
          value={loading ? '...' : `₹${formatCurrency(dashboard?.today_profit)}`}
          // helper="Estimated"
        />
        <MetricCard
          label="Low Stock"
          value={loading ? '...' : dashboard?.low_stock_count ?? 0}
          // helper="Needs attention"
        />
        </div>
      </div>

      <SectionCard title="Reports Summary">
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5">
            <p className="text-[9px] uppercase tracking-[0.22em] text-white/50">Today</p>
            <p className="mt-1 text-[12px] font-semibold text-white">
              {summaryLoading ? '...' : `₹${formatCurrency(summary?.today)}`}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5">
            <p className="text-[9px] uppercase tracking-[0.22em] text-white/50">Yesterday</p>
            <p className="mt-1 text-[12px] font-semibold text-white">
              {summaryLoading ? '...' : `₹${formatCurrency(summary?.yesterday)}`}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5">
            <p className="text-[9px] uppercase tracking-[0.22em] text-white/50">Week</p>
            <p className="mt-1 text-[12px] font-semibold text-white">
              {summaryLoading ? '...' : `₹${formatCurrency(summary?.week)}`}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-1.5">
            <p className="text-[9px] uppercase tracking-[0.22em] text-white/50">Month</p>
            <p className="mt-1 text-[12px] font-semibold text-white">
              {summaryLoading ? '...' : `₹${formatCurrency(summary?.month)}`}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Recent Orders">
        {loading && <p className="text-[12px] text-white/60">Loading orders...</p>}
        {!loading && (dashboard?.recent_orders || []).length === 0 && (
          <p className="text-[12px] text-white/60">No recent orders.</p>
        )}
        {!loading &&
          (dashboard?.recent_orders || []).map((order) => (
            <OrderItem key={order.id} order={order} />
          ))}
      </SectionCard>
    </MobileShell>
  );
};

export default DashboardMobile;
