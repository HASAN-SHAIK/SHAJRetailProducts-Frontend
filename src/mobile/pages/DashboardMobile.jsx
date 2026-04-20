import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { preloadProductsToIndexedDb } from '../../utils/indexedDb';
import api from '../../utils/axios';
import MobileShell from '../components/MobileShell';
import MetricCard from '../components/MetricCard';
import SectionCard from '../components/SectionCard';
import OrderItem from '../components/OrderItem';

const formatCurrency = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const DashboardMobile = () => {
  const preloadRef = useRef(false);
  const [dashboard, setDashboard] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    if (preloadRef.current) return;
    preloadRef.current = true;
    preloadProductsToIndexedDb().catch(() => {
      // Non-blocking for mobile dashboard load.
    });
  }, []);

  useEffect(() => {
    let active = true;
    const fetchDashboard = async () => {
      try {
        const res = await api.get('/mobile/dashboard');
        if (active) setDashboard(res.data || null);
      } catch {
        if (active) setDashboard(null);
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
        if (active) setSummary(res.data || null);
      } catch {
        if (active) setSummary(null);
      } finally {
        if (active) setSummaryLoading(false);
      }
    };
    fetchSummary();
    return () => {
      active = false;
    };
  }, []);

  const topMessage = useMemo(() => {
    if (loading) return 'Syncing business snapshot...';
    const lowStock = Number(dashboard?.low_stock_count || 0);
    if (lowStock > 0) return `${lowStock} low-stock products need attention today.`;
    return 'All key inventory indicators are healthy.';
  }, [dashboard?.low_stock_count, loading]);

  return (
    <MobileShell title="Dashboard" subtitle="Track sales, stock and operations from one mobile-first workspace.">
      <section className="mobile-card">
        <p className="mobile-card-title" style={{ margin: 0 }}>Today Focus</p>
        <p style={{ margin: '7px 0 0', fontSize: 15, fontWeight: 700 }}>
          {loading ? 'Loading data...' : `Rs ${formatCurrency(dashboard?.today_sales)}`}
        </p>
        <p className="mobile-muted" style={{ margin: '4px 0 0', fontSize: 11 }}>{topMessage}</p>
        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="mobile-chip">Orders: {loading ? '...' : dashboard?.today_orders ?? 0}</span>
          <span className="mobile-chip">Profit: Rs {loading ? '...' : formatCurrency(dashboard?.today_profit)}</span>
        </div>
      </section>

      <div className="mobile-grid-2">
        <MetricCard label="Today Sales" value={loading ? '...' : `Rs ${formatCurrency(dashboard?.today_sales)}`} helper="Gross sales" />
        <MetricCard label="Orders" value={loading ? '...' : dashboard?.today_orders ?? 0} helper="Placed today" />
        <MetricCard label="Profit" value={loading ? '...' : `Rs ${formatCurrency(dashboard?.today_profit)}`} helper="Estimated margin" />
        <MetricCard label="Low Stock" value={loading ? '...' : dashboard?.low_stock_count ?? 0} helper="Needs reorder" />
      </div>

      <SectionCard title="Summary Windows">
        <div className="mobile-inline-grid">
          <div className="mobile-item">
            <p className="mobile-card-title" style={{ margin: 0 }}>Today</p>
            <p style={{ margin: '5px 0 0', fontWeight: 700 }}>Rs {summaryLoading ? '...' : formatCurrency(summary?.today)}</p>
          </div>
          <div className="mobile-item">
            <p className="mobile-card-title" style={{ margin: 0 }}>Yesterday</p>
            <p style={{ margin: '5px 0 0', fontWeight: 700 }}>Rs {summaryLoading ? '...' : formatCurrency(summary?.yesterday)}</p>
          </div>
          <div className="mobile-item">
            <p className="mobile-card-title" style={{ margin: 0 }}>Week</p>
            <p style={{ margin: '5px 0 0', fontWeight: 700 }}>Rs {summaryLoading ? '...' : formatCurrency(summary?.week)}</p>
          </div>
          <div className="mobile-item">
            <p className="mobile-card-title" style={{ margin: 0 }}>Month</p>
            <p style={{ margin: '5px 0 0', fontWeight: 700 }}>Rs {summaryLoading ? '...' : formatCurrency(summary?.month)}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Quick Actions"
        action={<Link to="/m/reports" className="mobile-chip" style={{ textDecoration: 'none' }}>View Reports</Link>}
      >
        <div className="mobile-inline-grid">
          <Link to="/m/neworder" className="mobile-button" style={{ textDecoration: 'none', textAlign: 'center' }}>Create Bill</Link>
          <Link to="/m/products" className="mobile-button secondary" style={{ textDecoration: 'none', textAlign: 'center' }}>Check Stock</Link>
        </div>
      </SectionCard>

      <SectionCard title="Recent Orders" action={<Link to="/m/orders" className="mobile-chip" style={{ textDecoration: 'none' }}>Open All</Link>}>
        {loading && <p className="mobile-muted" style={{ margin: 0, fontSize: 12 }}>Loading recent orders...</p>}
        {!loading && (dashboard?.recent_orders || []).length === 0 && (
          <p className="mobile-muted" style={{ margin: 0, fontSize: 12 }}>No recent orders to display.</p>
        )}
        {!loading && (dashboard?.recent_orders || []).map((order) => <OrderItem key={order.id} order={order} />)}
      </SectionCard>
    </MobileShell>
  );
};

export default DashboardMobile;
