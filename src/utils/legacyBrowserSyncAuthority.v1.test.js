import fs from 'fs';
import path from 'path';
import { isLocalPosEnabled } from '../Repositories/local/posLocalApiClient';
import {
  LOCAL_POS_SYNC_REASON,
  isLegacyBrowserSyncAllowed,
  localPosSyncSkippedResult,
} from './legacyBrowserSyncAuthority';

jest.mock('../Repositories/local/posLocalApiClient', () => ({
  isLocalPosEnabled: jest.fn(),
}));

const readSource = (relativePath) =>
  fs.readFileSync(path.join(process.cwd(), 'src', relativePath), 'utf8');

describe('V1 local POS browser sync authority', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('local POS mode disables legacy browser synchronization authority', () => {
    isLocalPosEnabled.mockReturnValue(true);

    expect(isLegacyBrowserSyncAllowed()).toBe(false);
    expect(localPosSyncSkippedResult({ processed: 0 })).toEqual({
      skipped: true,
      reason: LOCAL_POS_SYNC_REASON,
      processed: 0,
    });
  });

  test('legacy non-local-POS deployments retain browser synchronization authority', () => {
    isLocalPosEnabled.mockReturnValue(false);
    expect(isLegacyBrowserSyncAllowed()).toBe(true);
  });

  test('all Sync Center legacy mutation paths are guarded at their browser sync boundaries', () => {
    const syncFacade = readSource('services/local/syncLocalService.js');
    const offlineFacade = readSource('services/local/offlineLocalService.js');
    const staffSync = readSource('utils/staffExpensesSync.js');
    const returnsSync = readSource('utils/returnsCorrectionsSync.js');

    expect(syncFacade).toContain('isLegacyBrowserSyncAllowed() ? syncFacade.getSyncQueueItems');
    expect(syncFacade).toContain('isLegacyBrowserSyncAllowed() ? syncFacade.getInventorySyncQueueEntries');
    expect(offlineFacade).toContain('isLegacyBrowserSyncAllowed() ? offlineFacade.getOfflineOrders');
    expect(offlineFacade).toContain('isLegacyBrowserSyncAllowed() ? offlineFacade.getOfflineImports');
    expect(staffSync).toContain('if (!isLegacyBrowserSyncAllowed())');
    expect(returnsSync).toContain('if (!isLegacyBrowserSyncAllowed())');
  });
});
