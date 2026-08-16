jest.mock('./axios', () => ({}));
jest.mock('./offlineOrders', () => ({ processOfflineQueue: jest.fn() }));
jest.mock('./staffExpensesSync', () => ({ syncAllStaffExpenses: jest.fn() }));
jest.mock('./returnsCorrectionsSync', () => ({ syncAllReturnsCorrections: jest.fn() }));
jest.mock('./importSync', () => ({ syncAllImports: jest.fn() }));
jest.mock('./customersSync', () => ({ syncAllCustomers: jest.fn() }));
jest.mock('./inventorySync', () => ({ processInventorySyncQueue: jest.fn() }));
jest.mock('./deltaSync', () => ({ runDeltaSync: jest.fn() }));
jest.mock('./indexedDb', () => ({
  preloadAllCaches: jest.fn(),
  preloadCustomersToIndexedDb: jest.fn(),
  preloadOrdersToIndexedDb: jest.fn(),
  preloadTransactionsToIndexedDb: jest.fn(),
}));
jest.mock('./syncStrategy', () => ({
  getSyncPlan: jest.fn(),
  markSyncPlanComplete: jest.fn(),
}));
jest.mock('../Repositories/local/posLocalApiClient', () => ({
  isLocalPosEnabled: jest.fn(),
}));

import { runAppSyncCycle } from './appSyncOrchestrator';
import { processOfflineQueue } from './offlineOrders';
import { syncAllCustomers } from './customersSync';
import { processInventorySyncQueue } from './inventorySync';
import { getSyncPlan, markSyncPlanComplete } from './syncStrategy';
import { isLocalPosEnabled } from '../Repositories/local/posLocalApiClient';

describe('V1 Frontend local POS sync authority', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
  });

  test('does not run legacy browser synchronization when local POS is authoritative', async () => {
    isLocalPosEnabled.mockReturnValue(true);

    const result = await runAppSyncCycle({
      tenantId: 'tenant-a',
      userId: 'user-a',
      branchId: 'branch-a',
      forceFull: true,
    });

    expect(result).toEqual({ mode: 'pos_edge', reason: 'local_pos_authoritative' });
    expect(getSyncPlan).not.toHaveBeenCalled();
    expect(processOfflineQueue).not.toHaveBeenCalled();
    expect(syncAllCustomers).not.toHaveBeenCalled();
    expect(processInventorySyncQueue).not.toHaveBeenCalled();
    expect(markSyncPlanComplete).not.toHaveBeenCalled();
  });

  test('retains the legacy browser path only when local POS mode is disabled', async () => {
    isLocalPosEnabled.mockReturnValue(false);
    getSyncPlan.mockResolvedValue({ mode: 'delta', reason: 'scheduled' });

    const result = await runAppSyncCycle({
      tenantId: 'tenant-a',
      userId: 'user-a',
      branchId: 'branch-a',
    });

    expect(result).toEqual({ mode: 'delta', reason: 'scheduled' });
    expect(getSyncPlan).toHaveBeenCalledTimes(1);
    expect(processOfflineQueue).toHaveBeenCalledTimes(1);
    expect(syncAllCustomers).toHaveBeenCalledTimes(1);
    expect(processInventorySyncQueue).toHaveBeenCalledTimes(1);
    expect(markSyncPlanComplete).toHaveBeenCalledTimes(1);
  });
});
