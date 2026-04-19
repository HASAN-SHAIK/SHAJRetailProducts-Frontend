import api from './axios';
import { processOfflineQueue } from './offlineOrders';
import { syncAllStaffExpenses } from './staffExpensesSync';
import { syncAllReturnsCorrections } from './returnsCorrectionsSync';
import { syncAllImports } from './importSync';
import { syncAllCustomers } from './customersSync';
import { processInventorySyncQueue } from './inventorySync';
import { runDeltaSync } from './deltaSync';
import {
  preloadAllCaches,
  preloadCustomersToIndexedDb,
  preloadOrdersToIndexedDb,
  preloadTransactionsToIndexedDb,
} from './indexedDb';
import { getSyncPlan, markSyncPlanComplete } from './syncStrategy';

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
  await preloadCustomersToIndexedDb();
  await preloadOrdersToIndexedDb();
  await preloadTransactionsToIndexedDb();
  await preloadAllCaches({ branchId, forceFull: true });
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
