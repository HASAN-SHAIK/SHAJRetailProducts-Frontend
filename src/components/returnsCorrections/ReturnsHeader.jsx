import React, { useEffect, useState } from 'react';
import { usePopup } from '../common/PopUp/PopupProvider';
import { syncAllReturnsCorrections } from '../../utils/returnsCorrectionsSync';

const ReturnsHeader = ({ title }) => {
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
      <button className="btn btn-outline-light" type="button" onClick={handleSync} disabled={syncing}>
        {syncing ? 'Syncing...' : 'Sync Now'}
      </button>
    </div>
  );
};

export default ReturnsHeader;
