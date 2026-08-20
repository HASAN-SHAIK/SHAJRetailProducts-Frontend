import api from './axios';
import { processOfflineQueue } from './offlineOrders';
import { syncAllStaffExpenses } from './staffExpensesSync';
import { syncAllReturnsCorrections } from './returnsCorrectionsSync';
import { syncAllImports } from './importSync';
import { syncAllCustomers } from './customersSync';
import { processInventorySyncQueue } from './inventorySync';
import { runDeltaSync } from './deltaSync';
import { getSyncPlan, markSyncPlanComplete } from './syncStrategy';
import { isLocalPosEnabled } from '../Repositories/local/posLocalApiClient';

const normalizeBranchId = (branchId) => {
  if (!branchId || branchId === 'all') return null;
  return branchId;
};

const buildSyncContext = ({ tenantId, userId, branchId } = {}) => ({
  tenantId: tenantId || 'tenant',
  userId: userId || 'user',
  branchId: normalizeBranchId(branchId) || 'all',
});

const runFullSeedSync = async ({ branchId }) => {
  await processOfflineQueue(api);
  await processInventorySyncQueue();
  await syncAllCustomers();
  await syncAllImports();
  await syncAllStaffExpenses({ refreshRemote: true });
  await syncAllReturnsCorrections({ refreshRemote: true });
  await runDeltaSync({ branchId, forceFull: true });
};

const runDeltaOnlySync = async ({ branchId }) => {
  await processOfflineQueue(api);
  await processInventorySyncQueue();
  await syncAllCustomers();
  await syncAllImports();
  await syncAllStaffExpenses({ refreshRemote: false });
  await syncAllReturnsCorrections({ refreshRemote: false });
  await runDeltaSync({ branchId });
};

export const runAppSyncCycle = async ({
  tenantId,
  userId,
  branchId,
  forceFull = false,
} = {}) => {
  // When the packaged local POS runtime is enabled, POSService/SQLite owns the
  // durable outbox/inbox and reconnect lifecycle. Screen-level reads continue
  // through the configured repositories.
  if (isLocalPosEnabled()) {
    return { mode: 'pos_edge', reason: 'local_pos_authoritative' };
  }

  if (!navigator.onLine) {
    return { mode: 'offline', reason: 'offline' };
  }
  const effectiveBranchId = normalizeBranchId(branchId);
  const context = buildSyncContext({ tenantId, userId, branchId: effectiveBranchId });
  const plan = await getSyncPlan(context, { forceFull });

  if (plan.mode === 'full') {
    await runFullSeedSync({ branchId: effectiveBranchId });
  } else {
    await runDeltaOnlySync({ branchId: effectiveBranchId });
  }

  await markSyncPlanComplete(context, plan);
  return plan;
};
