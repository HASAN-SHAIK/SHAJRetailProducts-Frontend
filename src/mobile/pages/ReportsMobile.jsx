import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSalesSummary } from '../../services/local';
import MobileShell from '../components/MobileShell';
import MetricCard from '../components/MetricCard';
import SectionCard from '../components/SectionCard';

const formatCurrency = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const ReportsMobile = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('month');

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await getSalesSummary();
      if (!payload) {
        throw new Error('report_unavailable');
      }
      setSummary(payload);
    } catch {
      setSummary(null);
      setError('Sales reporting is unavailable. Check Central connectivity or cached report data, then retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

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
  const metricValue = (value) => {
    if (loading) return '...';
    if (!summary) return 'Unavailable';
    return `Rs ${formatCurrency(value)}`;
  };

  return (
    <MobileShell title="Reports" subtitle="Canonical Central revenue summary with fixed V1 reporting windows.">
      <SectionCard title="Report Window">
        <div className="mobile-inline-grid">
          <div>
            <label className="mobile-label" htmlFor="mobile-report-period">Period</label>
            <select
              id="mobile-report-period"
              className="mobile-field"
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
            >
              <option value="today">Today</option>
              <option value="week">This week</option>
              <option value="month">This month</option>
            </select>
          </div>
          <div>
            <label className="mobile-label" htmlFor="mobile-report-growth">Growth</label>
            <input
              id="mobile-report-growth"
              className="mobile-field"
              value={summary ? `${growthPercent}% vs yesterday` : 'Unavailable'}
              readOnly
            />
          </div>
        </div>
        <p className="mobile-muted" style={{ margin: '8px 0 0', fontSize: 11 }}>
          These totals use the canonical Today / This week / This month windows supplied by Central. Custom date-range reporting is not exposed on this V1 mobile screen.
        </p>
      </SectionCard>

      {error ? (
        <SectionCard title="Reporting unavailable">
          <div role="alert" className="mobile-item" style={{ display: 'grid', gap: 8 }}>
            <p style={{ margin: 0 }}>{error}</p>
            <button type="button" className="mobile-button" onClick={fetchSummary} disabled={loading}>
              {loading ? 'Retrying...' : 'Retry report'}
            </button>
          </div>
        </SectionCard>
      ) : null}

      <div className="mobile-grid-2" aria-busy={loading ? 'true' : 'false'}>
        <MetricCard label="Today" value={metricValue(summary?.today)} helper="Daily sales" />
        <MetricCard label="Yesterday" value={metricValue(summary?.yesterday)} helper="Previous day" />
        <MetricCard label="Week" value={metricValue(summary?.week)} helper="7-day total" />
        <MetricCard label="Month" value={metricValue(summary?.month)} helper="Current month" />
      </div>

      <SectionCard title="Performance Snapshot">
        <div className="mobile-item">
          <p className="mobile-card-title" style={{ margin: 0 }}>{selectedWindowLabel}</p>
          <p style={{ margin: '6px 0 0', fontSize: 18, fontWeight: 700 }}>
            {metricValue(selectedWindowValue)}
          </p>
        </div>

        {summary ? (
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
        ) : null}
      </SectionCard>
    </MobileShell>
  );
};

export default ReportsMobile;
