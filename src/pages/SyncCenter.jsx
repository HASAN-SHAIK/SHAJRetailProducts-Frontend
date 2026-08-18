import React from 'react';
import { useSelector } from 'react-redux';
import SyncCenterContent from './SyncCenterContent';
import { canAccessSyncCenter } from './syncCenterAccess';

const SyncCenter = () => {
  const userDetails = useSelector((state) => state.user.userDetails);

  if (!canAccessSyncCenter(userDetails)) {
    return (
      <div className="wow-page">
        <div className="wow-content container-fluid p-0">
          <div className="alert alert-warning mb-0" role="alert">
            Sync Center is restricted to administrators. Cashier transaction synchronization status remains available from the Orders screen.
          </div>
        </div>
      </div>
    );
  }

  return <SyncCenterContent />;
};

export default SyncCenter;
