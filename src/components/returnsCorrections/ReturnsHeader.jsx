import React, { useEffect, useState } from 'react';
import { usePopup } from '../common/PopUp/PopupProvider';
import { syncAllReturnsCorrections } from '../../utils/returnsCorrectionsSync';
import { isLocalPosEnabled } from '../../Repositories/local/posLocalApiClient';

const ReturnsHeader = ({ title }) => {
  const { showPopup } = usePopup();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const localPosAuthoritative = isLocalPosEnabled();

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
    if (localPosAuthoritative) {
      showPopup('Local POS synchronization is automatic. Use Sync Center diagnostics for sync state.', 'POS Sync');
      return;
    }
    if (syncing) return;
    setSyncing(true);
    try {
      await syncAllReturnsCorrections();
      showPopup('Synced Successfully', 'Success');
    } catch {
      showPopup('Sync failed. Try again.', 'Error');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="returns-header">
      <div>
        <h2>{title}</h2>
        {!isOnline && <span className="offline-chip">Offline</span>}
      </div>
      <button
        className="btn btn-outline-light"
        type="button"
        onClick={handleSync}
        disabled={syncing || localPosAuthoritative}
        aria-disabled={syncing || localPosAuthoritative}
        title={localPosAuthoritative ? 'Local POS synchronization runs automatically' : undefined}
      >
        {localPosAuthoritative ? 'POS Sync Automatic' : syncing ? 'Syncing...' : 'Sync Now'}
      </button>
    </div>
  );
};

export default ReturnsHeader;
