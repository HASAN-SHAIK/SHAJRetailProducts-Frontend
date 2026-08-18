import { isLocalPosEnabled } from '../Repositories/local/posLocalApiClient';

export const LOCAL_POS_SYNC_REASON = 'local_pos_authoritative';

export const isLegacyBrowserSyncAllowed = () => !isLocalPosEnabled();

export const localPosSyncSkippedResult = (extra = {}) => ({
  skipped: true,
  reason: LOCAL_POS_SYNC_REASON,
  ...extra,
});
