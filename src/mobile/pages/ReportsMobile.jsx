import { useEffect, useState } from 'react';
import api from '../../utils/axios';
import MobileShell from '../components/MobileShell';
import MetricCard from '../components/MetricCard';

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const ReportsMobile = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

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
        if (active) setLoading(false);
      }
    };
    fetchSummary();
    return () => {
      active = false;
    };
  }, []);

  return (
    <MobileShell title="Reports" subtitle="Sales summary for quick decisions.">
      <div className="grid grid-cols-2 gap-2 text-center">
        <MetricCard
          label="Today"
          value={loading ? '...' : `₹${formatCurrency(summary?.today)}`}
        />
        <MetricCard
          label="Yesterday"
          value={loading ? '...' : `₹${formatCurrency(summary?.yesterday)}`}
        />
        <MetricCard
          label="Week"
          value={loading ? '...' : `₹${formatCurrency(summary?.week)}`}
        />
        <MetricCard
          label="Month"
          value={loading ? '...' : `₹${formatCurrency(summary?.month)}`}
        />
      </div>
    </MobileShell>
  );
};

export default ReportsMobile;
