import React, { useEffect, useState } from 'react';
import { usePopup } from '../common/PopUp/PopupProvider';
import { syncAllStaffExpenses } from '../../utils/staffExpensesSync';

const StaffExpensesHeader = ({ title }) => {
  const { showPopup } = usePopup();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSync = async () => {
    if (syncing) return;
    if (!navigator.onLine) {
      showPopup('You are offline. Connect to internet and retry sync.', 'Error');
      return;
    }
    setSyncing(true);
    try {
      const result = await syncAllStaffExpenses();
      const syncedCount = Array.isArray(result?.synced) ? result.synced.length : 0;
      const failedCount = Array.isArray(result?.failed) ? result.failed.length : 0;
      const remoteErrorCount = Array.isArray(result?.remoteErrors) ? result.remoteErrors.length : 0;
      if (failedCount > 0 || remoteErrorCount > 0) {
        const firstError =
          result?.failed?.[0]?.message ||
          result?.remoteErrors?.[0] ||
          'Some records failed to sync.';
        showPopup(
          `Synced ${syncedCount}. Failed ${failedCount}${remoteErrorCount ? `, refresh errors ${remoteErrorCount}` : ''}. ${firstError}`,
          'Error'
        );
      } else {
        showPopup(`Synced Successfully (${syncedCount})`, 'Success');
      }
    } catch (error) {
      const message = error?.message || 'Sync failed. Try again.';
      showPopup(message, 'Error');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="staff-expenses-header">
      <div>
        <h2>{title}</h2>
        {!isOnline && <span className="offline-chip">Offline</span>}
      </div>
      <button className="btn btn-outline-light" type="button" onClick={handleSync} disabled={syncing}>
        {syncing ? 'Syncing...' : 'Sync Now'}
      </button>
    </div>
  );
};

export default StaffExpensesHeader;
