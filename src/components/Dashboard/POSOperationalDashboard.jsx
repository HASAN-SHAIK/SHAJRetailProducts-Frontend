import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { isLocalPosEnabled, localPosHealth, localPosRequest } from '../../Repositories/local/posLocalApiClient';

const numberOrZero = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const pick = (object, paths, fallback = null) => {
  for (const path of paths) {
    const value = path.split('.').reduce((current, key) => current?.[key], object);
    if (value !== undefined && value !== null) return value;
  }
  return fallback;
};

const Metric = ({ label, value, tone = 'secondary' }) => (
  <div className="col-12 col-sm-6 col-xl-3">
    <div className="card h-100 shadow-sm border-0">
      <div className="card-body">
        <div className="text-muted small mb-1">{label}</div>
        <div className={`fs-4 fw-semibold text-${tone}`}>{value}</div>
      </div>
    </div>
  </div>
);

const POSOperationalDashboard = () => {
  const [state, setState] = useState({ loading: true, health: null, diagnostics: null, error: null });

  const refresh = async () => {
    if (!isLocalPosEnabled()) {
      setState({ loading: false, health: null, diagnostics: null, error: 'Local POS mode is disabled on this device.' });
      return;
    }
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [healthResult, diagnosticsResult] = await Promise.allSettled([
        localPosHealth(),
        localPosRequest('/diagnostics'),
      ]);
      const health = healthResult.status === 'fulfilled' ? healthResult.value : null;
      const diagnostics = diagnosticsResult.status === 'fulfilled' ? diagnosticsResult.value : null;
      if (!health && !diagnostics) throw new Error('local_pos_unavailable');
      setState({ loading: false, health, diagnostics, error: null });
    } catch {
      setState({ loading: false, health: null, diagnostics: null, error: 'POSService is unavailable. Start the local service and retry.' });
    }
  };

  useEffect(() => { refresh(); }, []);

  const metrics = useMemo(() => {
    const diagnostics = state.diagnostics || {};
    return {
      pending: numberOrZero(pick(diagnostics, ['outbox.pending', 'outbox_pending', 'sync.outbox_pending'], 0)),
      dead: numberOrZero(pick(diagnostics, ['outbox.dead_letter', 'outbox.dead', 'dead_letter_count', 'sync.dead_letter_count'], 0)),
      inboxFailed: numberOrZero(pick(diagnostics, ['inbox.failed', 'inbox_failed', 'sync.inbox_failed'], 0)),
      backup: pick(diagnostics, ['backup.latest_at', 'backup.latest_timestamp', 'latest_backup_at'], 'Not reported'),
    };
  }, [state.diagnostics]);

  const healthy = Boolean(state.health && (state.health.status === 'ok' || state.health.status === 'healthy' || state.health.ok === true));

  return (
    <div className="container-fluid py-4">
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
        <div>
          <div className="text-uppercase text-muted small fw-semibold">POS operations</div>
          <h1 className="h3 mb-1">Store runtime</h1>
          <p className="text-muted mb-0">Business analytics now live in SHAJ Retail Hub. This screen is limited to local POS health and synchronization operations.</p>
        </div>
        <div className="d-flex gap-2">
          <Link className="btn btn-outline-primary" to="/sync-center">Open Sync Center</Link>
          <button className="btn btn-primary" type="button" onClick={refresh} disabled={state.loading}>{state.loading ? 'Checking…' : 'Refresh POS'}</button>
        </div>
      </div>

      {state.error && <div className="alert alert-warning" role="alert">{state.error}</div>}

      <div className="row g-3 mb-4">
        <Metric label="POSService" value={state.loading ? 'Checking…' : healthy ? 'Healthy' : 'Attention'} tone={healthy ? 'success' : 'warning'} />
        <Metric label="Pending sync events" value={metrics.pending} tone={metrics.pending > 0 ? 'warning' : 'success'} />
        <Metric label="Dead-letter events" value={metrics.dead} tone={metrics.dead > 0 ? 'danger' : 'success'} />
        <Metric label="Failed inbound events" value={metrics.inboxFailed} tone={metrics.inboxFailed > 0 ? 'danger' : 'success'} />
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body d-flex flex-wrap justify-content-between gap-3 align-items-center">
          <div>
            <h2 className="h5 mb-1">Local recovery readiness</h2>
            <div className="text-muted">Latest reported POS backup: {String(metrics.backup)}</div>
          </div>
          <div className="text-muted small">Revenue, profit, inventory analytics, product/category performance, customer credit, branch performance and smart insights are managed in Retail Hub.</div>
        </div>
      </div>
    </div>
  );
};

export default POSOperationalDashboard;
