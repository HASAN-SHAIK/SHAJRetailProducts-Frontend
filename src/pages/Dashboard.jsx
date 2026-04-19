import { useEffect, useRef } from "react";
import DashboardOverview from "../components/Dashboard/DashboardOverview/DashboardOverview";
import { preloadProductsToIndexedDb } from "../utils/indexedDb";

const Dashboard = ({ navigate}) => {
  const preloadRef = useRef(false);
  useEffect(() => {
    console.log('[cacheDB] Dashboard.jsx mounted');
  }, []);

  useEffect(() => {
    console.log('[cacheDB] Dashboard.jsx preload check', { already: preloadRef.current });
    if (preloadRef.current) return;
    preloadRef.current = true;
    console.log('[cacheDB] Dashboard.jsx preload start');
    preloadProductsToIndexedDb()
      .then(() => console.log('[cacheDB] Dashboard.jsx preload success'))
      .catch((err) => {
        console.error('[cacheDB] Dashboard.jsx preload failed', err);
      });
  }, []);
    return (
      <div className="wow-page">
        <div className="wow-motion-layer" aria-hidden="true">
          <span className="wow-orb orb-a"></span>
          <span className="wow-orb orb-b"></span>
          <span className="wow-orb orb-c"></span>
          <span className="wow-orb orb-d"></span>
          <span className="wow-ring ring-a"></span>
          <span className="wow-ring ring-b"></span>
          <span className="wow-pulse"></span>
        </div>
        <div className="wow-content container-fluid">
          <DashboardOverview navigate = {navigate}/>
        </div>
      </div>
    );
  };
  
  export default Dashboard;
