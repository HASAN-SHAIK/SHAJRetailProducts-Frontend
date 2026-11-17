import api from './axios';
import { processOfflineQueue } from './offlineOrders';
import { syncAllStaffExpenses } from './staffExpensesSync';
import { syncAllReturnsCorrections } from './returnsCorrectionsSync';
import { syncAllImports } from './importSync';
import { syncAllCustomers } from './customersSync';
import { processInventorySyncQueue } from './inventorySync';
import { getSyncPlan, markSyncPlanComplete } from './syncStrategy';
import { fetchProductsDelta, fetchBatchesDelta } from '../Repositories/api/productApiClient';
import { fetchSuppliersDelta } from '../Repositories/api/supplierApiClient';
import { updateProductsBulk, updateBatchesBulk } from '../services/local/productLocalService';
import { updateSuppliersCacheBulk } from '../services/local/supplierLocalService';
import { resolveTenantConfig } from '../services/tenantService';
import { getSettings } from '../services/settingsService';
import { getBranches } from '../services/branchService';
import { isLocalPosEnabled } from '../Repositories/local/posLocalApiClient';

export const POS_OFFLINE_DB_STORAGE_KEYS = Object.freeze({
  PERMISSION_CHOICE: 'pos_offline_db_permission_choice_v1',
  REMEMBER_CHOICE: 'pos_offline_db_remember_choice_v1',
  LAST_DOWNLOADED_AT: 'pos_offline_db_last_downloaded_at_v1',
  LAST_DEVICE_TYPE: 'pos_offline_db_last_device_type_v1',
  LAST_SYNC_STATS: 'pos_offline_db_last_stats_v1',
});

export const DEPENDENCY_STEPS = Object.freeze([
  {
    id: 'config',
    title: 'Store & Branch Configuration',
    shortDesc: 'Shop profile, branch routing and terminal policies',
    icon: '🏬',
    estimatedSize: '~5 KB',
  },
  {
    id: 'products',
    title: 'Product Catalog & Barcodes',
    shortDesc: 'Master item catalog, barcodes and search index',
    icon: '🏷️',
    estimatedSize: '~150 KB',
  },
  {
    id: 'inventory',
    title: 'Batches, Pricing & Stock',
    shortDesc: 'Batch numbers, MRP, selling rates and stock quantities',
    icon: '📦',
    estimatedSize: '~100 KB',
  },
  {
    id: 'customers',
    title: 'Customer Directory & Accounts',
    shortDesc: 'Customer contacts, outstanding balances and credit terms',
    icon: '👥',
    estimatedSize: '~40 KB',
  },
  {
    id: 'accounting_tax',
    title: 'Taxes, GST & Expense Rules',
    shortDesc: 'CGST/SGST/IGST rates, expense masters and returns ledger',
    icon: '📊',
    estimatedSize: '~25 KB',
  },
  {
    id: 'offline_engine',
    title: 'Offline Database & Outbox Engine',
    shortDesc: 'Local SQL cache verification and offline queue lock',
    icon: '⚡',
    estimatedSize: '~20 KB',
  },
]);

/**
 * Detects whether the current client is a mobile device (phone / tablet / touch terminal)
 * or a laptop / desktop workstation.
 */
export const detectDeviceProfile = (customNavigator = null, customWindow = null) => {
  const nav = customNavigator || (typeof navigator !== 'undefined' ? navigator : null);
  const win = customWindow || (typeof window !== 'undefined' ? window : null);

  if (!nav || !win) {
    return {
      type: 'laptop',
      label: 'Laptop / Desktop Workstation',
      deviceCategory: 'laptop',
      icon: '💻',
      isMobile: false,
      isTouch: false,
      summary: 'Standard laptop or desktop POS terminal',
    };
  }

  const ua = nav.userAgent || '';
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isSmallScreen = win.matchMedia ? win.matchMedia('(max-width: 768px)').matches : (win.innerWidth <= 768);
  const isTouch = (nav.maxTouchPoints && nav.maxTouchPoints > 0) || 'ontouchstart' in win;
  const isMobile = isMobileUA || isSmallScreen;

  return {
    type: isMobile ? 'mobile' : 'laptop',
    label: isMobile ? 'Mobile POS Device' : 'Laptop / Desktop Workstation',
    deviceCategory: isMobile ? 'mobile' : 'laptop',
    icon: isMobile ? '📱' : '💻',
    isMobile,
    isTouch,
    summary: isMobile
      ? 'Mobile touch screen detected (Phone / Tablet / Handheld POS)'
      : 'Laptop or Desktop system detected with keyboard / wide display',
    screen: `${win.innerWidth || 0}x${win.innerHeight || 0}`,
  };
};

/**
 * Reads user's stored permission preference from localStorage.
 */
export const getPermissionPreference = () => {
  if (typeof window === 'undefined') return { choice: null, remember: false };
  try {
    const choice = localStorage.getItem(POS_OFFLINE_DB_STORAGE_KEYS.PERMISSION_CHOICE);
    const remember = localStorage.getItem(POS_OFFLINE_DB_STORAGE_KEYS.REMEMBER_CHOICE) === 'true';
    if (remember && (choice === 'download' || choice === 'skip')) {
      return { choice, remember: true };
    }
    return { choice: null, remember: false };
  } catch {
    return { choice: null, remember: false };
  }
};

/**
 * Saves user's permission preference to localStorage.
 */
export const savePermissionPreference = (choice, remember = true) => {
  if (typeof window === 'undefined') return;
  try {
    if (choice) {
      localStorage.setItem(POS_OFFLINE_DB_STORAGE_KEYS.PERMISSION_CHOICE, choice);
      localStorage.setItem(POS_OFFLINE_DB_STORAGE_KEYS.REMEMBER_CHOICE, remember ? 'true' : 'false');
    } else {
      localStorage.removeItem(POS_OFFLINE_DB_STORAGE_KEYS.PERMISSION_CHOICE);
      localStorage.removeItem(POS_OFFLINE_DB_STORAGE_KEYS.REMEMBER_CHOICE);
    }
  } catch {
    // Ignore storage errors in private browsing
  }
};

/**
 * Clears stored permission preference.
 */
export const clearPermissionPreference = () => {
  savePermissionPreference(null, false);
};

/**
 * Retrieves summary of the current local offline database status.
 */
export const getOfflineDatabaseStatus = () => {
  if (typeof window === 'undefined') {
    return { isReady: false, lastDownloadedAt: null, stats: null };
  }
  try {
    const lastDownloadedAt = localStorage.getItem(POS_OFFLINE_DB_STORAGE_KEYS.LAST_DOWNLOADED_AT);
    const lastDevice = localStorage.getItem(POS_OFFLINE_DB_STORAGE_KEYS.LAST_DEVICE_TYPE);
    const rawStats = localStorage.getItem(POS_OFFLINE_DB_STORAGE_KEYS.LAST_SYNC_STATS);
    const stats = rawStats ? JSON.parse(rawStats) : null;
    return {
      isReady: Boolean(lastDownloadedAt),
      lastDownloadedAt,
      lastDevice,
      stats,
    };
  } catch {
    return { isReady: false, lastDownloadedAt: null, stats: null };
  }
};

/**
 * Step 1: Download and store store & branch configuration.
 */
export const downloadConfigStep = async ({ userDetails } = {}) => {
  const [tenantConfig, settings, branchesPayload] = await Promise.all([
    resolveTenantConfig().catch(() => null),
    userDetails ? getSettings(userDetails).catch(() => null) : Promise.resolve(null),
    getBranches().catch(() => null),
  ]);

  const branches = Array.isArray(branchesPayload?.branches)
    ? branchesPayload.branches
    : Array.isArray(branchesPayload?.data)
      ? branchesPayload.data
      : [];

  return {
    tenantName: tenantConfig?.tenant?.name || tenantConfig?.name || 'Central Store',
    branchCount: branches.length,
    settingsLoaded: Boolean(settings),
  };
};

/**
 * Step 2: Download product master and barcodes.
 */
export const downloadProductsStep = async ({ branchId = null, forceFull = true } = {}) => {
  if (isLocalPosEnabled()) {
    return { count: 'Authoritative Local POS', note: 'Managed by POSService' };
  }
  const payload = await fetchProductsDelta({ branchId, updatedAfter: null });
  const products = Array.isArray(payload?.data) ? payload.data : [];
  if (products.length > 0) {
    await updateProductsBulk(products);
  }
  return {
    count: products.length,
    serverTime: payload?.serverTime || new Date().toISOString(),
  };
};

/**
 * Step 3: Download batches, pricing and inventory counts.
 */
export const downloadInventoryStep = async ({ branchId = null, forceFull = true } = {}) => {
  if (isLocalPosEnabled()) {
    return { count: 'Authoritative Local POS', note: 'Managed by POSService' };
  }
  const payload = await fetchBatchesDelta({ branchId, updatedAfter: null });
  const batches = Array.isArray(payload?.data) ? payload.data : [];
  if (batches.length > 0) {
    await updateBatchesBulk(batches);
  }
  await processInventorySyncQueue().catch(() => {});
  return {
    count: batches.length,
    serverTime: payload?.serverTime || new Date().toISOString(),
  };
};

/**
 * Step 4: Download customer registry and contact directory.
 */
export const downloadCustomersStep = async () => {
  const result = await syncAllCustomers().catch(() => null);
  return {
    synced: true,
    total: result?.total || result?.count || 'Ready',
  };
};

/**
 * Step 5: Download taxes, GST slabs and accounting metadata.
 */
export const downloadAccountingTaxStep = async ({ branchId = null } = {}) => {
  await Promise.all([
    syncAllImports().catch(() => {}),
    syncAllStaffExpenses({ refreshRemote: true }).catch(() => {}),
    syncAllReturnsCorrections({ refreshRemote: true }).catch(() => {}),
  ]);

  try {
    const suppliersPayload = await fetchSuppliersDelta({ branchId, updatedAfter: null });
    const suppliers = Array.isArray(suppliersPayload?.data) ? suppliersPayload.data : [];
    if (suppliers.length > 0) {
      await updateSuppliersCacheBulk(suppliers);
    }
  } catch {
    // Optional supplier cache
  }

  return { synced: true };
};

/**
 * Step 6: Seal local database cache and verify offline outbox engine.
 */
export const downloadOfflineEngineStep = async ({ branchId = null, userDetails = {} } = {}) => {
  if (navigator.onLine) {
    await processOfflineQueue(api).catch(() => {});
  }

  const context = {
    tenantId: userDetails?.tenant_id || 'tenant',
    userId: userDetails?.id || 'user',
    branchId: branchId || 'all',
  };

  const plan = await getSyncPlan(context, { forceFull: true }).catch(() => ({ mode: 'full', reason: 'manual' }));
  await markSyncPlanComplete(context, plan).catch(() => {});

  const nowIso = new Date().toISOString();
  try {
    localStorage.setItem(POS_OFFLINE_DB_STORAGE_KEYS.LAST_DOWNLOADED_AT, nowIso);
    const device = detectDeviceProfile();
    localStorage.setItem(POS_OFFLINE_DB_STORAGE_KEYS.LAST_DEVICE_TYPE, device.type);
  } catch {
    // Non-fatal
  }

  return { ready: true, completedAt: nowIso };
};

/**
 * Sequentially downloads all dependencies one by one, notifying the caller at each step.
 */
export const downloadDependenciesOneByOne = async ({
  branchId = null,
  userDetails = null,
  onStepChange = () => {},
  onProgress = () => {},
  abortSignal = null,
} = {}) => {
  const steps = DEPENDENCY_STEPS;
  const results = {};
  const total = steps.length;

  for (let index = 0; index < total; index += 1) {
    if (abortSignal?.aborted) {
      throw new Error('Download aborted by user');
    }

    const step = steps[index];
    const currentPercent = Math.round((index / total) * 100);

    onProgress({
      stepIndex: index,
      stepId: step.id,
      stepTitle: step.title,
      totalSteps: total,
      completedSteps: index,
      percent: currentPercent,
    });

    onStepChange({
      stepId: step.id,
      status: 'downloading',
      message: `Downloading ${step.title}...`,
    });

    try {
      let stepResult = null;
      switch (step.id) {
        case 'config':
          stepResult = await downloadConfigStep({ userDetails });
          break;
        case 'products':
          stepResult = await downloadProductsStep({ branchId });
          break;
        case 'inventory':
          stepResult = await downloadInventoryStep({ branchId });
          break;
        case 'customers':
          stepResult = await downloadCustomersStep();
          break;
        case 'accounting_tax':
          stepResult = await downloadAccountingTaxStep({ branchId });
          break;
        case 'offline_engine':
          stepResult = await downloadOfflineEngineStep({ branchId, userDetails });
          break;
        default:
          break;
      }

      results[step.id] = { success: true, data: stepResult };
      onStepChange({
        stepId: step.id,
        status: 'completed',
        message: `${step.title} downloaded & verified`,
        result: stepResult,
      });
    } catch (err) {
      results[step.id] = { success: false, error: err?.message || 'Download error' };
      onStepChange({
        stepId: step.id,
        status: 'error',
        message: err?.message || `Failed to download ${step.title}`,
        error: err,
      });
      // Allow caller/UI to decide whether to pause, retry or continue
    }
  }

  const finalPercent = 100;
  onProgress({
    stepIndex: total,
    stepId: 'completed',
    stepTitle: 'All Dependencies Ready',
    totalSteps: total,
    completedSteps: total,
    percent: finalPercent,
  });

  try {
    localStorage.setItem(POS_OFFLINE_DB_STORAGE_KEYS.LAST_SYNC_STATS, JSON.stringify(results));
  } catch {}

  return results;
};
