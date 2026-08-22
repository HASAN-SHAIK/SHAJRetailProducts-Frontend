import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { usePopup } from '../components/common/PopUp/PopupProvider';
import { processOfflineQueue } from '../utils/offlineOrders';
import { syncAllCustomers } from '../utils/customersSync';
import { syncAllImports } from '../utils/importSync';
import { processInventorySyncQueue } from '../utils/inventorySync';
import { syncAllStaffExpenses } from '../utils/staffExpensesSync';
import { syncAllReturnsCorrections } from '../utils/returnsCorrectionsSync';
import { runAppSyncCycle } from '../utils/appSyncOrchestrator';
import { useBranchStore } from '../store/branchStore';
import api from '../utils/axios';
import { backfillPurchasePayments } from '../services/accountingService';
import { isLocalPosEnabled, localPosRequest } from '../Repositories/local/posLocalApiClient';
import './SyncCenter.css';

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const formatDuration = (seconds) => {
  const total = Number(seconds || 0);
  if (!Number.isFinite(total) || total <= 0) return '-';
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(1, minutes)}m`;
};

const formatJSON = (value) => {
  if (!value) return '';
  try {
    return JSON.stringify(typeof value === 'string' ? JSON.parse(value) : value, null, 2);
  } catch {
    return String(value);
  }
};

const getInboxID = (message) => message?.message_id || message?.id || '';

const describeLocalPosDiagnosticsError = (error, fallback = 'Local POS diagnostics unavailable') => {
  const code = error?.payload?.error || error?.message || '';
  if (code === 'local_pos_token_unavailable') return 'Local POS token unavailable';
  if (code === 'local_pos_session_unavailable') return 'Local POS session missing';
  if (code === 'local_auth_required' || error?.status === 401) return 'Local POS token rejected';
  if (code === 'origin_not_allowed' || error?.status === 403) return 'Local POS origin blocked';
  if (code === 'Failed to fetch' || error?.name === 'TypeError') return 'POSService unreachable';
  if (Number(error?.status || 0) >= 500) return 'Local POS diagnostics failed';
  return fallback;
};

const SyncCenter = () => {
  const { showPopup } = usePopup();
  const userDetails = useSelector((state) => state.user.userDetails);
  const selectedBranchId = useBranchStore((state) => state.selectedBranchId);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [forceFullSyncing, setForceFullSyncing] = useState(false);
  const [runningModule, setRunningModule] = useState('');
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [backfillPreviewBusy, setBackfillPreviewBusy] = useState(false);
  const [backfillOrderIdsInput, setBackfillOrderIdsInput] = useState('');
  const [posDiagnostics, setPosDiagnostics] = useState(null);
  const [posDiagnosticsError, setPosDiagnosticsError] = useState('');
  const [syncEventDetails, setSyncEventDetails] = useState(null);
  const [syncEventDetailsError, setSyncEventDetailsError] = useState('');
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [skippingMessage, setSkippingMessage] = useState('');

  const loadQueues = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const diagnosticsResult = isLocalPosEnabled()
        ? await localPosRequest('/diagnostics', { requireSession: false })
            .then((payload) => ({ ok: true, payload }))
            .catch((error) => ({ ok: false, error }))
        : { ok: false, disabled: true };
      if (diagnosticsResult.ok) {
        setPosDiagnostics(diagnosticsResult.payload);
        setPosDiagnosticsError('');
      } else {
        setPosDiagnostics(null);
        setPosDiagnosticsError(diagnosticsResult.disabled ? 'Local POS mode disabled' : describeLocalPosDiagnosticsError(diagnosticsResult.error));
      }
      if (isLocalPosEnabled()) {
        setDetailsLoading(true);
        const detailsResult = await localPosRequest('/diagnostics/sync-events?limit=100', { requireSession: false })
          .then((payload) => ({ ok: true, payload }))
          .catch((error) => ({ ok: false, error }));
        if (detailsResult.ok) {
          setSyncEventDetails(detailsResult.payload);
          setSyncEventDetailsError('');
        } else {
          setSyncEventDetails(null);
          setSyncEventDetailsError(describeLocalPosDiagnosticsError(detailsResult.error, 'Unable to load stuck sync event details.'));
        }
      } else {
        setSyncEventDetails(null);
        setSyncEventDetailsError('');
      }
    } catch (err) {
      showPopup('Unable to load sync queues right now.', 'Sync Center');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setDetailsLoading(false);
    }
  }, [showPopup]);

  useEffect(() => {
    loadQueues();
  }, [loadQueues]);

  useEffect(() => {
    const handleQueueChange = () => {
      loadQueues(true);
    };
    window.addEventListener('offline-order-enqueued', handleQueueChange);
    window.addEventListener('offline-queue-updated', handleQueueChange);
    window.addEventListener('online', handleQueueChange);
    const timer = setInterval(() => loadQueues(true), 15000);
    return () => {
      window.removeEventListener('offline-order-enqueued', handleQueueChange);
      window.removeEventListener('offline-queue-updated', handleQueueChange);
      window.removeEventListener('online', handleQueueChange);
      clearInterval(timer);
    };
  }, [loadQueues]);

  const posStats = useMemo(() => {
    const outbox = posDiagnostics?.outbox || {};
    const pending = Number(outbox.pending || 0);
    const processing = Number(outbox.processing || 0);
    const failed = Number(outbox.failed || 0);
    const deadLetter = Number(outbox.dead_letter || 0);
    return {
      needsSync: pending + processing + failed + deadLetter,
      pending,
      processing,
      failed,
      deadLetter,
      published: Number(outbox.published || 0),
      inboxReceived: Number(posDiagnostics?.inbox_received || 0),
      inboxFailed: Number(posDiagnostics?.inbox_failed || 0),
      customerConflicts: Number(posDiagnostics?.customer_conflicts || 0),
      unsyncedCustomers: Number(posDiagnostics?.unsynced_customers || 0),
      oldestPendingAt: outbox.oldest_pending_at || null,
      collectedAt: posDiagnostics?.collected_at || null,
      databaseOK: posDiagnostics?.database_ok === true,
    };
  }, [posDiagnostics]);

  const runModuleSync = useCallback(async (moduleKey, runner, label) => {
    setRunningModule(moduleKey);
    try {
      await runner();
      return { ok: true };
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || `${label} sync failed`;
      return { ok: false, message };
    } finally {
      setRunningModule('');
    }
  }, []);

  const moduleActions = useMemo(() => ([
    {
      key: 'customers',
      label: 'Customers',
      run: () => syncAllCustomers(),
    },
    {
      key: 'orders',
      label: 'Orders',
      run: () => processOfflineQueue(api),
    },
    {
      key: 'inventory',
      label: 'Inventory',
      run: () => processInventorySyncQueue(),
    },
    {
      key: 'imports',
      label: 'Imports',
      run: () => syncAllImports(),
    },
    {
      key: 'staff',
      label: 'Staff & Expenses',
      run: () => syncAllStaffExpenses(),
    },
    {
      key: 'returns',
      label: 'Returns & Corrections',
      run: () => syncAllReturnsCorrections(),
    },
  ]), []);

  const handleRetryAll = async () => {
    if (syncingAll || runningModule) return;
    setSyncingAll(true);
    let failures = 0;
    for (const module of moduleActions) {
      const result = await runModuleSync(module.key, module.run, module.label);
      if (!result.ok) {
        failures += 1;
      }
    }
    await loadQueues(true);
    setSyncingAll(false);
    if (failures > 0) {
      showPopup(`Retry all finished with ${failures} module error(s).`, 'Sync Center');
      return;
    }
    showPopup('All sync modules completed successfully.', 'Sync Center');
  };

  const handleForceFullSync = async () => {
    if (forceFullSyncing || syncingAll || runningModule) return;
    if (!navigator.onLine) {
      showPopup('You are offline. Connect to internet and retry.', 'Sync Center');
      return;
    }
    setForceFullSyncing(true);
    try {
      const plan = await runAppSyncCycle({
        tenantId: userDetails?.tenant_id,
        userId: userDetails?.id,
        branchId: selectedBranchId,
        forceFull: true,
      });
      await loadQueues(true);
      showPopup(`Full sync completed (${plan?.reason || 'manual'}).`, 'Sync Center');
    } catch (err) {
      showPopup(err?.response?.data?.message || err?.message || 'Force full sync failed.', 'Sync Center');
    } finally {
      setForceFullSyncing(false);
    }
  };

  const handleBackfillPurchasePayments = async () => {
    if (backfillBusy) return;
    if (!navigator.onLine) {
      showPopup('Backfill needs online server access.', 'Sync Center');
      return;
    }
    const ok = window.confirm('Backfill missing purchase payment records now? Ledger entries will NOT be recreated.');
    if (!ok) return;
    setBackfillBusy(true);
    try {
      const onlyOrderIds = String(backfillOrderIdsInput || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      const summary = await backfillPurchasePayments({ onlyOrderIds });
      const created = Number(summary?.created || 0);
      const affected = Number(summary?.affected_orders || 0);
      const failed = Number(summary?.failed || 0);
      showPopup(
        `Backfill complete. Created ${created}/${affected} missing payment record(s)${failed ? `, failed ${failed}` : ''}.`,
        'Sync Center'
      );
      if (failed) {
        console.warn('[BackfillPurchasePayments] Partial failure', summary);
      } else {
        console.log('[BackfillPurchasePayments] Success', summary);
      }
    } catch (err) {
      showPopup(err?.response?.data?.message || err?.message || 'Backfill failed.', 'Sync Center');
    } finally {
      setBackfillBusy(false);
    }
  };

  const handlePreviewBackfillPurchasePayments = async () => {
    if (backfillPreviewBusy) return;
    if (!navigator.onLine) {
      showPopup('Preview needs online server access.', 'Sync Center');
      return;
    }
    setBackfillPreviewBusy(true);
    try {
      const onlyOrderIds = String(backfillOrderIdsInput || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      const summary = await backfillPurchasePayments({ dryRun: true, onlyOrderIds });
      const affected = Number(summary?.affected_orders || 0);
      const ids = Array.isArray(summary?.affected_order_ids) ? summary.affected_order_ids : [];
      const previewIds = ids.slice(0, 15).join(', ');
      if (affected === 0) {
        showPopup('Preview complete. No missing purchase payments found.', 'Sync Center');
      } else {
        const msg = previewIds
          ? `Preview: ${affected} order(s) missing payment records. Sample IDs: ${previewIds}${ids.length > 15 ? ' ...' : ''}`
          : `Preview: ${affected} order(s) missing payment records.`;
        showPopup(msg, 'Sync Center');
      }
      console.log('[BackfillPurchasePayments][DryRun]', summary);
    } catch (err) {
      showPopup(err?.response?.data?.message || err?.message || 'Backfill preview failed.', 'Sync Center');
    } finally {
      setBackfillPreviewBusy(false);
    }
  };

  const handleSkipSyncMessage = async (queue, item) => {
    const id = queue === 'outbox' ? item?.id : getInboxID(item);
    if (!id || skippingMessage) return;
    const label = queue === 'outbox' ? (item?.event_type || item?.aggregate_type || id) : (item?.message_type || id);
    if (!window.confirm(`Skip this ${queue} sync message?\n\n${label}\n\nOnly use this when the message is no longer required.`)) {
      return;
    }
    setSkippingMessage(`${queue}:${id}`);
    try {
      await localPosRequest(`/diagnostics/${queue}/${encodeURIComponent(id)}/skip`, {
        method: 'POST',
        body: { reason: 'Skipped from Sync Center by operator' },
      });
      await loadQueues(true);
      showPopup(`Skipped ${queue} sync message.`, 'Sync Center');
    } catch (err) {
      showPopup(err?.payload?.error || err?.message || `Unable to skip ${queue} sync message.`, 'Sync Center');
    } finally {
      setSkippingMessage('');
    }
  };

  const outboxDetails = Array.isArray(syncEventDetails?.outbox) ? syncEventDetails.outbox : [];
  const inboxDetails = Array.isArray(syncEventDetails?.inbox) ? syncEventDetails.inbox : [];

  return (
    <div className="wow-page">
      <div className="wow-content container-fluid p-0 sync-center-page">
      <div className="sync-center-head">
        <div>
          <h3>Sync Center</h3>
          <small className="text-secondary">Track pending records and trigger retries.</small>
        </div>
        <div className="sync-center-actions">
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Order IDs (optional): 1,2,4,7"
            value={backfillOrderIdsInput}
            onChange={(event) => setBackfillOrderIdsInput(event.target.value)}
            style={{ maxWidth: 260 }}
          />
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => loadQueues(true)}
            disabled={loading || refreshing || syncingAll}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleRetryAll}
            disabled={loading || refreshing || syncingAll || Boolean(runningModule)}
          >
            {syncingAll ? 'Retrying...' : 'Retry All'}
          </button>
          <button
            type="button"
            className="btn btn-outline-warning btn-sm"
            onClick={handleForceFullSync}
            disabled={loading || refreshing || syncingAll || Boolean(runningModule) || forceFullSyncing}
          >
            {forceFullSyncing ? 'Full Syncing...' : 'Force Full Sync'}
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={handlePreviewBackfillPurchasePayments}
            disabled={loading || refreshing || syncingAll || Boolean(runningModule) || backfillBusy || backfillPreviewBusy}
          >
            {backfillPreviewBusy ? 'Previewing...' : 'Preview Backfill'}
          </button>
          <button
            type="button"
            className="btn btn-outline-danger btn-sm"
            onClick={handleBackfillPurchasePayments}
            disabled={loading || refreshing || syncingAll || Boolean(runningModule) || backfillBusy || backfillPreviewBusy}
          >
            {backfillBusy ? 'Backfilling...' : 'Backfill Purchase Payments'}
          </button>
        </div>
      </div>

      <div className="sync-local-panel">
        <div className="sync-local-panel-head">
          <div>
            <h5>Local POS Sync Queues</h5>
            <small className="text-secondary">
              SQLite outbox and inbox status from POSService.
              {posStats.collectedAt ? ` Updated ${formatDateTime(posStats.collectedAt)}.` : ''}
            </small>
          </div>
          <span className={`sync-status-badge ${posStats.databaseOK ? 'status-synced' : 'status-error'}`}>
            {posStats.databaseOK ? 'SQLite OK' : posDiagnosticsError || 'Unavailable'}
          </span>
        </div>
        <div className="sync-local-stats">
          <div className="sync-stat-card sync-stat-primary">
            <span>Needs Sync</span>
            <strong>{posDiagnostics ? posStats.needsSync : '-'}</strong>
            <small>pending local sync records</small>
          </div>
          <div className="sync-stat-card">
            <span>Outbox Pending</span>
            <strong>{posDiagnostics ? posStats.pending : '-'}</strong>
            <small>{posStats.oldestPendingAt ? `Oldest ${formatDateTime(posStats.oldestPendingAt)}` : 'Waiting to publish'}</small>
          </div>
          <div className="sync-stat-card">
            <span>Outbox Processing</span>
            <strong>{posDiagnostics ? posStats.processing : '-'}</strong>
            <small>claimed by sync worker</small>
          </div>
          <div className="sync-stat-card">
            <span>Outbox Failed</span>
            <strong>{posDiagnostics ? posStats.failed : '-'}</strong>
            <small>{posStats.deadLetter ? `${posStats.deadLetter} dead-lettered` : 'retryable failures'}</small>
          </div>
          <div className="sync-stat-card">
            <span>Inbox Received</span>
            <strong>{posDiagnostics ? posStats.inboxReceived : '-'}</strong>
            <small>HQ changes waiting/applied locally</small>
          </div>
          <div className="sync-stat-card">
            <span>Inbox Failed</span>
            <strong>{posDiagnostics ? posStats.inboxFailed : '-'}</strong>
            <small>change-feed apply errors</small>
          </div>
          <div className="sync-stat-card">
            <span>Customer Conflicts</span>
            <strong>{posDiagnostics ? posStats.customerConflicts : '-'}</strong>
            <small>{posStats.unsyncedCustomers} customer edit(s) pending</small>
          </div>
        </div>
      </div>

      <div className="sync-details-panel">
        <div className="sync-details-head">
          <div>
            <h5>Needs Sync Details</h5>
            <small className="text-secondary">
              {syncEventDetails?.collected_at ? `Details updated ${formatDateTime(syncEventDetails.collected_at)}.` : 'Shows stuck outbox and inbox messages from SQLite.'}
            </small>
          </div>
          <button
            type="button"
            className="btn btn-outline-info btn-sm"
            onClick={() => loadQueues(true)}
            disabled={detailsLoading || refreshing || Boolean(skippingMessage)}
          >
            {detailsLoading ? 'Refreshing Details...' : 'Refresh Details'}
          </button>
        </div>
        {syncEventDetailsError && <div className="sync-details-error">{syncEventDetailsError}</div>}
        <div className="sync-details-section">
          <h6>Outbox Messages</h6>
          {outboxDetails.length === 0 ? (
            <div className="text-secondary">No stuck outbox events.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle sync-detail-table">
                <thead>
                  <tr>
                    <th>Message</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Attempts</th>
                    <th>Stuck Since</th>
                    <th>Age</th>
                    <th>Next Retry</th>
                    <th>Error</th>
                    <th>Payload</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {outboxDetails.map((event) => {
                    const key = `outbox:${event.id}`;
                    return (
                      <tr key={key}>
                        <td>
                          <strong>{event.id}</strong>
                          <small className="d-block text-secondary">{event.aggregate_type}:{event.aggregate_id}</small>
                          <small className="d-block text-secondary">{event.ordering_key}</small>
                        </td>
                        <td>{event.event_type}</td>
                        <td><span className={`sync-status-badge status-${event.status}`}>{event.status}</span></td>
                        <td>{event.attempt_count ?? 0}</td>
                        <td>{formatDateTime(event.stuck_since || event.created_at)}</td>
                        <td>{formatDuration(event.age_seconds)}</td>
                        <td>{formatDateTime(event.available_at)}</td>
                        <td className="sync-detail-error">{event.last_error || 'Waiting for sync worker.'}</td>
                        <td>
                          <details className="sync-event-payload">
                            <summary>View JSON</summary>
                            <pre>{formatJSON({ payload: event.payload, metadata: event.metadata })}</pre>
                          </details>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-warning"
                            onClick={() => handleSkipSyncMessage('outbox', event)}
                            disabled={Boolean(skippingMessage)}
                          >
                            {skippingMessage === key ? 'Skipping...' : 'Skip'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="sync-details-section">
          <h6>Inbox Messages</h6>
          {inboxDetails.length === 0 ? (
            <div className="text-secondary">No stuck inbox messages.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle sync-detail-table">
                <thead>
                  <tr>
                    <th>Message</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Attempts</th>
                    <th>Stuck Since</th>
                    <th>Age</th>
                    <th>Received</th>
                    <th>Error</th>
                    <th>Payload</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {inboxDetails.map((message) => {
                    const id = getInboxID(message);
                    const key = `inbox:${id}`;
                    return (
                      <tr key={key}>
                        <td>
                          <strong>{id}</strong>
                          <small className="d-block text-secondary">{message.source || 'central'}</small>
                        </td>
                        <td>{message.message_type}</td>
                        <td><span className={`sync-status-badge status-${message.status}`}>{message.status}</span></td>
                        <td>{message.attempt_count ?? 0}</td>
                        <td>{formatDateTime(message.stuck_since || message.received_at)}</td>
                        <td>{formatDuration(message.age_seconds)}</td>
                        <td>{formatDateTime(message.received_at)}</td>
                        <td className="sync-detail-error">{message.last_error || 'Waiting to apply locally.'}</td>
                        <td>
                          <details className="sync-event-payload">
                            <summary>View JSON</summary>
                            <pre>{formatJSON(message.payload)}</pre>
                          </details>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-warning"
                            onClick={() => handleSkipSyncMessage('inbox', message)}
                            disabled={Boolean(skippingMessage)}
                          >
                            {skippingMessage === key ? 'Skipping...' : 'Skip'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="sync-local-panel sync-backup-summary">
        <div className="sync-local-panel-head">
          <div>
            <h5>Backup & Restore Health</h5>
            <small className="text-secondary">Latest local SQLite backup reported by POSService.</small>
          </div>
          <span className="sync-status-badge status-synced">
            {posDiagnostics?.latest_backup_at ? 'Backup Found' : 'No Backup'}
          </span>
        </div>
        <div className="sync-local-stats">
          <div className="sync-stat-card">
            <span>Latest Backup</span>
            <strong>{formatDateTime(posDiagnostics?.latest_backup_at)}</strong>
            <small>{posDiagnostics?.latest_backup_bytes ? `${posDiagnostics.latest_backup_bytes} bytes` : 'No backup file reported'}</small>
          </div>
          <div className="sync-stat-card">
            <span>Change Cursor</span>
            <strong className="sync-stat-text">{posDiagnostics?.last_change_cursor || '-'}</strong>
            <small>last Central inbox checkpoint</small>
          </div>
        </div>
      </div>

    </div>
    </div>
  );
};

export default SyncCenter;
