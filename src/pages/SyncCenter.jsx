import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { usePopup } from '../components/common/PopUp/PopupProvider';
import { getOfflineImports, getSyncQueueItems, updateSyncQueueItem } from '../core/db';
import { getOfflineOrderQueue, processOfflineQueue } from '../utils/offlineOrders';
import { syncAllCustomers } from '../utils/customersSync';
import { syncAllImports } from '../utils/importSync';
import { processInventorySyncQueue } from '../utils/inventorySync';
import { syncAllStaffExpenses } from '../utils/staffExpensesSync';
import { syncAllReturnsCorrections } from '../utils/returnsCorrectionsSync';
import { runAppSyncCycle } from '../utils/appSyncOrchestrator';
import { useBranchStore } from '../store/branchStore';
import api from '../utils/axios';
import { buildFullBackup, restoreLocalFromBackup, verifyBackup } from '../utils/backupRestore';
import './SyncCenter.css';

const isQueuePending = (status) => {
  const value = String(status || '').toLowerCase();
  return value === 'pending' || value === 'processing' || value === 'failed' || value === 'error';
};

const humanizeStatus = (value) => {
  const status = String(value || '').toLowerCase();
  if (!status) return 'unknown';
  if (status === 'done') return 'synced';
  return status;
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const SyncCenter = () => {
  const { showPopup } = usePopup();
  const userDetails = useSelector((state) => state.user.userDetails);
  const selectedBranchId = useBranchStore((state) => state.selectedBranchId);
  const selectedBranchName = useBranchStore((state) => state.selectedBranchName);
  const branches = useBranchStore((state) => state.branches);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [forceFullSyncing, setForceFullSyncing] = useState(false);
  const [runningModule, setRunningModule] = useState('');
  const [offlineOrders, setOfflineOrders] = useState([]);
  const [syncQueue, setSyncQueue] = useState([]);
  const [moduleResults, setModuleResults] = useState({});
  const [backupBusy, setBackupBusy] = useState(false);
  const [loadedBackup, setLoadedBackup] = useState(null);
  const [backupVerification, setBackupVerification] = useState(null);
  const [duplicateEntity, setDuplicateEntity] = useState('customer');
  const [duplicateRows, setDuplicateRows] = useState([]);
  const [duplicatesLoading, setDuplicatesLoading] = useState(false);
  const [mergingKey, setMergingKey] = useState('');
  const [consistencyRun, setConsistencyRun] = useState(null);
  const [consistencyBusy, setConsistencyBusy] = useState(false);
  const [importHistory, setImportHistory] = useState([]);
  const [importHistoryLoading, setImportHistoryLoading] = useState(false);

  const loadQueues = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const [orders, queueItems] = await Promise.all([getOfflineOrderQueue(), getSyncQueueItems()]);
      setOfflineOrders(Array.isArray(orders) ? orders : []);
      setSyncQueue(Array.isArray(queueItems) ? queueItems : []);
    } catch (err) {
      showPopup('Unable to load sync queues right now.', 'Sync Center');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showPopup]);

  useEffect(() => {
    loadQueues();
  }, [loadQueues]);

  const loadImportHistory = useCallback(async () => {
    setImportHistoryLoading(true);
    try {
      const list = await getOfflineImports();
      const safe = Array.isArray(list) ? list : [];
      safe.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      setImportHistory(safe);
    } catch {
      setImportHistory([]);
    } finally {
      setImportHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadImportHistory();
  }, [loadImportHistory]);

  const loadDuplicates = useCallback(async (entity = duplicateEntity) => {
    setDuplicatesLoading(true);
    try {
      const res = await api.get('/data-quality/duplicates', { params: { entity, limit: 80 } });
      const list = res?.data?.data?.suggestions || [];
      setDuplicateRows(Array.isArray(list) ? list : []);
    } catch (err) {
      setDuplicateRows([]);
      showPopup('Unable to load duplicate suggestions.', 'Data Quality');
    } finally {
      setDuplicatesLoading(false);
    }
  }, [duplicateEntity, showPopup]);

  useEffect(() => {
    loadDuplicates(duplicateEntity);
  }, [duplicateEntity, loadDuplicates]);

  const loadConsistencyRun = useCallback(async () => {
    try {
      const res = await api.get('/data-quality/stock-consistency/latest');
      setConsistencyRun(res?.data?.data?.run || null);
    } catch {
      setConsistencyRun(null);
    }
  }, []);

  useEffect(() => {
    loadConsistencyRun();
  }, [loadConsistencyRun]);

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

  const queueStats = useMemo(() => {
    const pendingQueue = syncQueue.filter((entry) => isQueuePending(entry?.status)).length;
    const failedQueue = syncQueue.filter((entry) => {
      const status = String(entry?.status || '').toLowerCase();
      return status === 'failed' || status === 'error';
    }).length;
    return {
      offlinePending: offlineOrders.length,
      queuePending: pendingQueue,
      queueFailed: failedQueue,
    };
  }, [offlineOrders, syncQueue]);

  const getBranchLabel = useCallback((entry) => {
    const rawBranchId = entry?.branch_id ?? entry?.branchId ?? entry?.payload?.branch_id ?? entry?.payload?.branchId;
    const branchId = rawBranchId !== null && rawBranchId !== undefined ? String(rawBranchId) : '';
    if (!branchId) return '-';
    if (branchId === 'all') return 'All';
    if (String(selectedBranchId || '') === branchId && selectedBranchName) return selectedBranchName;
    const match = (Array.isArray(branches) ? branches : []).find((branch) => String(branch?.id) === branchId);
    return String(match?.name || match?.branch_name || match?.title || branchId);
  }, [branches, selectedBranchId, selectedBranchName]);

  const purchaseSyncNotes = useMemo(() => {
    return (Array.isArray(syncQueue) ? syncQueue : [])
      .filter((entry) => String(entry?.type || '').toLowerCase() === 'purchase')
      .filter((entry) => isQueuePending(entry?.status))
      .sort((a, b) => {
        const aTime = new Date(a?.updated_at || a?.updatedAt || a?.createdAt || 0).getTime();
        const bTime = new Date(b?.updated_at || b?.updatedAt || b?.createdAt || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 20);
  }, [syncQueue]);

  const runModuleSync = useCallback(async (moduleKey, runner, label) => {
    setRunningModule(moduleKey);
    try {
      const result = await runner();
      setModuleResults((prev) => ({
        ...prev,
        [moduleKey]: {
          ok: true,
          label: `${label} synced`,
          at: new Date().toISOString(),
          detail: result || null,
        },
      }));
      return { ok: true };
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || `${label} sync failed`;
      setModuleResults((prev) => ({
        ...prev,
        [moduleKey]: {
          ok: false,
          label: message,
          at: new Date().toISOString(),
          detail: null,
        },
      }));
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

  const handleRunSingle = async (module) => {
    if (syncingAll || runningModule) return;
    const result = await runModuleSync(module.key, module.run, module.label);
    await loadQueues(true);
    if (module.key === 'imports') {
      await loadImportHistory();
    }
    if (!result.ok) {
      showPopup(result.message || `${module.label} sync failed`, 'Sync Center');
    }
  };

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
    await loadImportHistory();
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

  const handleExportBackup = async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    try {
      const payload = await buildFullBackup();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.href = url;
      link.download = `shaj-full-backup-${stamp}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showPopup('Full backup downloaded (IndexedDB + server export).', 'Backup');
    } catch (err) {
      showPopup(err?.response?.data?.message || err?.message || 'Backup export failed.', 'Backup');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleBackupFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      setLoadedBackup(parsed);
      setBackupVerification(null);
      showPopup('Backup file loaded. Verify before restore.', 'Backup');
    } catch {
      setLoadedBackup(null);
      setBackupVerification(null);
      showPopup('Invalid backup file.', 'Backup');
    } finally {
      event.target.value = '';
    }
  };

  const handleVerifyLoadedBackup = async () => {
    if (!loadedBackup || backupBusy) return;
    setBackupBusy(true);
    try {
      const verification = await verifyBackup(loadedBackup);
      setBackupVerification(verification);
      const serverValid = verification?.server?.valid;
      if (serverValid === false) {
        showPopup('Backup verification failed for server export checksum.', 'Backup');
      } else {
        showPopup('Backup verification completed.', 'Backup');
      }
    } catch (err) {
      showPopup(err?.response?.data?.message || err?.message || 'Backup verification failed.', 'Backup');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleRestoreLocalBackup = async () => {
    if (!loadedBackup || backupBusy) return;
    setBackupBusy(true);
    try {
      await restoreLocalFromBackup(loadedBackup);
      showPopup('Local IndexedDB restored from backup.', 'Backup');
      await loadQueues(true);
    } catch (err) {
      showPopup(err?.message || 'Local restore failed.', 'Backup');
    } finally {
      setBackupBusy(false);
    }
  };

  const groupedDuplicates = useMemo(() => {
    const map = new Map();
    duplicateRows.forEach((row) => {
      const key = `${row.reason || 'match'}::${row.match_key || '-'}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(row);
    });
    return Array.from(map.entries());
  }, [duplicateRows]);

  const handleMergeRecords = async (primaryId, secondaryId) => {
    if (!primaryId || !secondaryId || String(primaryId) === String(secondaryId)) return;
    const ok = window.confirm(`Merge ${duplicateEntity} ${secondaryId} into ${primaryId}?`);
    if (!ok) return;
    const key = `${primaryId}:${secondaryId}`;
    setMergingKey(key);
    try {
      await api.post('/data-quality/merge', {
        entity: duplicateEntity,
        primary_id: Number(primaryId),
        secondary_id: Number(secondaryId),
        reason: 'manual_dedupe_from_sync_center'
      });
      showPopup('Merge completed.', 'Data Quality');
      await loadDuplicates(duplicateEntity);
    } catch (err) {
      showPopup(err?.response?.data?.message || err?.message || 'Merge failed.', 'Data Quality');
    } finally {
      setMergingKey('');
    }
  };

  const handleRunConsistency = async () => {
    if (consistencyBusy) return;
    setConsistencyBusy(true);
    try {
      await api.post('/data-quality/stock-consistency/run', { auto_heal: true });
      await loadConsistencyRun();
      showPopup('Stock consistency check completed.', 'Data Quality');
    } catch (err) {
      showPopup(err?.response?.data?.message || err?.message || 'Stock consistency run failed.', 'Data Quality');
    } finally {
      setConsistencyBusy(false);
    }
  };

  const handleRetryImport = async (importId) => {
    if (!importId) return;
    try {
      const queue = await getSyncQueueItems({ type: 'import' });
      const entry = queue.find((item) => item.refId === importId || item.importId === importId);
      if (entry) {
        await updateSyncQueueItem({
          ...entry,
          status: 'pending',
          retryCount: Number(entry.retryCount || 0),
        });
      }
      await loadImportHistory();
      await loadQueues(true);
      if (navigator.onLine) {
        await syncAllImports().catch(() => {});
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="wow-page">
      <div className="wow-content container-fluid p-0 sync-center-page">
      <div className="sync-center-head">
        <div>
          <h3>Sync Center</h3>
          <small className="text-secondary">Track pending records and trigger retries.</small>
        </div>
        <div className="sync-center-actions">
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
        </div>
      </div>

      <div className="sync-center-stats">
        <div className="sync-stat-card">
          <span>Offline Orders Pending</span>
          <strong>{queueStats.offlinePending}</strong>
        </div>
        <div className="sync-stat-card">
          <span>Sync Queue Pending</span>
          <strong>{queueStats.queuePending}</strong>
        </div>
        <div className="sync-stat-card">
          <span>Sync Queue Failed</span>
          <strong>{queueStats.queueFailed}</strong>
        </div>
      </div>

      <div className="sync-module-grid">
        {moduleActions.map((module) => {
          const result = moduleResults[module.key] || null;
          const isRunning = runningModule === module.key || (syncingAll && !runningModule);
          return (
            <div key={module.key} className="sync-module-card">
              <div className="sync-module-title">{module.label}</div>
              <button
                type="button"
                className="btn btn-outline-success btn-sm"
                onClick={() => handleRunSingle(module)}
                disabled={loading || refreshing || syncingAll || Boolean(runningModule)}
              >
                {isRunning ? 'Running...' : 'Retry'}
              </button>
              {result ? (
                <small className={result.ok ? 'text-success' : 'text-danger'}>
                  {result.label} · {formatDateTime(result.at)}
                </small>
              ) : (
                <small className="text-secondary">Not run yet</small>
              )}
            </div>
          );
        })}
      </div>

      <div className="sync-table-wrap mt-3">
        <h5>Stock Consistency Guard</h5>
        <div className="sync-center-actions">
          <button type="button" className="btn btn-outline-primary btn-sm" onClick={handleRunConsistency} disabled={consistencyBusy}>
            {consistencyBusy ? 'Running...' : 'Run Consistency Now'}
          </button>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={loadConsistencyRun} disabled={consistencyBusy}>
            Refresh Report
          </button>
        </div>
        <small className="text-secondary">
          Last run: {consistencyRun?.started_at ? formatDateTime(consistencyRun.started_at) : 'Never'} | mismatches: {Number(consistencyRun?.mismatch_count || 0)} | healed: {Number(consistencyRun?.healed_count || 0)}
        </small>
      </div>

      <div className="sync-table-wrap mt-3">
        <h5>Backup & Restore Health</h5>
        <div className="sync-center-actions">
          <button type="button" className="btn btn-outline-primary btn-sm" onClick={handleExportBackup} disabled={backupBusy}>
            {backupBusy ? 'Working...' : 'Download Full Backup'}
          </button>
          <label className="btn btn-outline-secondary btn-sm mb-0">
            Load Backup File
            <input type="file" accept=".json" onChange={handleBackupFile} style={{ display: 'none' }} />
          </label>
          <button type="button" className="btn btn-outline-success btn-sm" onClick={handleVerifyLoadedBackup} disabled={!loadedBackup || backupBusy}>
            Verify Backup
          </button>
          <button type="button" className="btn btn-outline-warning btn-sm" onClick={handleRestoreLocalBackup} disabled={!loadedBackup || backupBusy}>
            Restore Local DB
          </button>
        </div>
        {backupVerification && (
          <div className="sync-backup-summary">
            <small className="text-secondary">
              Local checksum: {backupVerification?.local?.checksumMatches === true ? 'valid' : backupVerification?.local?.checksumMatches === false ? 'mismatch' : 'unknown'}
              {' | '}
              Server checksum: {backupVerification?.server?.valid === true ? 'valid' : backupVerification?.server?.valid === false ? 'mismatch' : 'not checked'}
            </small>
          </div>
        )}
      </div>

      <div className="sync-table-wrap mt-3">
        <h5>Duplicate & Merge Control</h5>
        <div className="sync-center-actions">
          <select
            className="form-select form-select-sm sync-inline-select"
            value={duplicateEntity}
            onChange={(event) => setDuplicateEntity(event.target.value)}
            disabled={duplicatesLoading || Boolean(mergingKey)}
          >
            <option value="customer">Customers</option>
            <option value="product">Products</option>
          </select>
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => loadDuplicates(duplicateEntity)}
            disabled={duplicatesLoading || Boolean(mergingKey)}
          >
            {duplicatesLoading ? 'Loading...' : 'Refresh Suggestions'}
          </button>
        </div>
        <div className="table-responsive mt-2">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>Match Key</th>
                <th>Reason</th>
                <th>Candidates</th>
                <th>Merge</th>
              </tr>
            </thead>
            <tbody>
              {duplicatesLoading ? (
                <tr>
                  <td colSpan={4} className="text-secondary">Loading suggestions...</td>
                </tr>
              ) : groupedDuplicates.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-secondary">No duplicates detected.</td>
                </tr>
              ) : groupedDuplicates.map(([key, rows]) => {
                const primary = rows[0];
                const secondaries = rows.slice(1);
                return (
                  <tr key={key}>
                    <td>{primary?.match_key || '-'}</td>
                    <td>{primary?.reason || '-'}</td>
                    <td>
                      {rows.map((row) => (
                        <div key={`${key}-${row.id}`}>
                          #{row.id} {row.name || '-'} {row.phone ? `(${row.phone})` : row.barcode ? `(${row.barcode})` : ''}
                        </div>
                      ))}
                    </td>
                    <td>
                      {secondaries.length === 0 ? (
                        <small className="text-secondary">Need at least 2</small>
                      ) : secondaries.map((row) => {
                        const mergeKey = `${primary.id}:${row.id}`;
                        return (
                          <button
                            key={mergeKey}
                            type="button"
                            className="btn btn-outline-danger btn-sm me-1 mb-1"
                            disabled={Boolean(mergingKey)}
                            onClick={() => handleMergeRecords(primary.id, row.id)}
                          >
                            {mergingKey === mergeKey ? 'Merging...' : `Merge #${row.id} -> #${primary.id}`}
                          </button>
                        );
                      })
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sync-table-wrap mt-3">
        <h5>Import History</h5>
        <div className="sync-center-actions mb-2">
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => syncAllImports().then(() => loadImportHistory())}
            disabled={!navigator.onLine}
          >
            Sync Now
          </button>
        </div>
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>Date</th>
                <th>Items</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {importHistoryLoading ? (
                <tr>
                  <td colSpan={4} className="text-secondary">Loading imports...</td>
                </tr>
              ) : importHistory.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-secondary">No imports yet.</td>
                </tr>
              ) : importHistory.map((entry) => {
                const status = humanizeStatus(entry?.status);
                return (
                  <tr key={entry.id}>
                    <td>{formatDateTime(entry.createdAt)}</td>
                    <td>{entry.totalItems || 0}</td>
                    <td>
                      <span className={`sync-status-badge status-${status}`}>{status}</span>
                    </td>
                    <td>
                      {status === 'failed' && (
                        <button
                          type="button"
                          className="btn btn-outline-warning btn-sm"
                          onClick={() => handleRetryImport(entry.id)}
                        >
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sync-table-wrap mt-3">
        <h5>Purchase Sync Notes</h5>
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>#</th>
                <th>Purchase Ref</th>
                <th>Branch</th>
                <th>Status</th>
                <th>Retries</th>
                <th>Reason</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-secondary">Loading notes...</td>
                </tr>
              ) : purchaseSyncNotes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-secondary">No purchase sync notes.</td>
                </tr>
              ) : purchaseSyncNotes.map((entry, index) => {
                const status = humanizeStatus(entry?.status);
                return (
                  <tr key={entry?.id || `purchase-note-${index}`}>
                    <td>{index + 1}</td>
                    <td>{entry?.entityId || entry?.refId || '-'}</td>
                    <td>{getBranchLabel(entry)}</td>
                    <td>
                      <span className={`sync-status-badge status-${status}`}>{status}</span>
                    </td>
                    <td>{Number(entry?.retryCount || entry?.retries || 0)}</td>
                    <td>{entry?.last_error || '-'}</td>
                    <td>{formatDateTime(entry?.updated_at || entry?.updatedAt || entry?.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sync-table-wrap mt-3">
        <h5>Offline Orders Queue</h5>
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>#</th>
                <th>Order Ref</th>
                <th>Type</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-secondary">Loading queue...</td>
                </tr>
              ) : offlineOrders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-secondary">No offline orders pending.</td>
                </tr>
              ) : offlineOrders.map((entry, index) => (
                <tr key={entry?.id || `offline-${index}`}>
                  <td>{index + 1}</td>
                  <td>{entry?.payload?.client_order_id || entry?.id || '-'}</td>
                  <td>{entry?.type || '-'}</td>
                  <td>{formatDateTime(entry?.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="sync-table-wrap mt-3">
        <h5>Generic Sync Queue</h5>
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>#</th>
                <th>Type</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Branch</th>
                <th>Status</th>
                <th>Retries</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-secondary">Loading queue...</td>
                </tr>
              ) : syncQueue.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-secondary">No sync queue entries found.</td>
                </tr>
              ) : syncQueue.map((entry, index) => {
                const status = humanizeStatus(entry?.status);
                return (
                  <tr key={entry?.id || `queue-${index}`}>
                    <td>{index + 1}</td>
                    <td>{entry?.type || '-'}</td>
                    <td>{entry?.action || '-'}</td>
                    <td>{entry?.entityId || entry?.refId || '-'}</td>
                    <td>{getBranchLabel(entry)}</td>
                    <td>
                      <span className={`sync-status-badge status-${status}`}>{status}</span>
                    </td>
                    <td>{Number(entry?.retryCount || entry?.retries || 0)}</td>
                    <td>{formatDateTime(entry?.updated_at || entry?.updatedAt || entry?.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </div>
  );
};

export default SyncCenter;
