import { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import api from '../../utils/axios';
import MobileShell from '../components/MobileShell';
import MetricCard from '../components/MetricCard';
import SectionCard from '../components/SectionCard';

const formatCurrency = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const ReportsMobile = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [fromDate, setFromDate] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [toDate, setToDate] = useState(dayjs().format('YYYY-MM-DD'));

  useEffect(() => {
    let active = true;
    const fetchSummary = async () => {
      try {
        const res = await api.get('/mobile/sales-summary');
        if (active) setSummary(res.data || null);
      } catch {
        if (active) setSummary(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchSummary();
    return () => {
      active = false;
    };
  }, []);

  const today = Number(summary?.today || 0);
  const week = Number(summary?.week || 0);
  const month = Number(summary?.month || 0);

  const growthPercent = useMemo(() => {
    const yesterday = Number(summary?.yesterday || 0);
    if (!yesterday) return today > 0 ? 100 : 0;
    return Math.round(((today - yesterday) / yesterday) * 100);
  }, [summary?.yesterday, today]);

  const selectedWindowLabel = period === 'today' ? 'Today window' : period === 'week' ? 'This week window' : 'This month window';
  const selectedWindowValue = period === 'today' ? today : period === 'week' ? week : month;

  return (
    <MobileShell title="Reports" subtitle="Revenue insights with quick period and date controls.">
      <SectionCard title="Report Filters">
        <div className="mobile-inline-grid">
          <div>
            <label className="mobile-label">Period</label>
            <select className="mobile-field" value={period} onChange={(event) => setPeriod(event.target.value)}>
              <option value="today">Today</option>
              <option value="week">This week</option>
              <option value="month">This month</option>
            </select>
          </div>
          <div>
            <label className="mobile-label">Growth</label>
            <input className="mobile-field" value={`${growthPercent}% vs yesterday`} readOnly />
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

      <div className="mobile-grid-2">
        <MetricCard label="Today" value={loading ? '...' : `Rs ${formatCurrency(summary?.today)}`} helper="Daily sales" />
        <MetricCard label="Yesterday" value={loading ? '...' : `Rs ${formatCurrency(summary?.yesterday)}`} helper="Previous day" />
        <MetricCard label="Week" value={loading ? '...' : `Rs ${formatCurrency(summary?.week)}`} helper="7-day total" />
        <MetricCard label="Month" value={loading ? '...' : `Rs ${formatCurrency(summary?.month)}`} helper="Current month" />
      </div>

      <SectionCard title="Performance Snapshot">
        <div className="mobile-item">
          <p className="mobile-card-title" style={{ margin: 0 }}>{selectedWindowLabel}</p>
          <p style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 700 }}>Rs {loading ? '...' : formatCurrency(selectedWindowValue)}</p>
          <p className="mobile-muted" style={{ margin: '6px 0 0', fontSize: 11 }}>
            Date span: {dayjs(fromDate).format('DD MMM YYYY')} to {dayjs(toDate).format('DD MMM YYYY')}
          </p>
        </div>

        <div className="mobile-item" style={{ display: 'grid', gap: 8 }}>
          <div>
            <p className="mobile-label" style={{ marginBottom: 4 }}>Today vs Month</p>
            <progress max={Math.max(month, 1)} value={today} style={{ width: '100%' }} />
          </div>
          <div>
            <p className="mobile-label" style={{ marginBottom: 4 }}>Week vs Month</p>
            <progress max={Math.max(month, 1)} value={week} style={{ width: '100%' }} />
          </div>
        </div>
      </SectionCard>
    </MobileShell>
  );
};

export default ReportsMobile;
