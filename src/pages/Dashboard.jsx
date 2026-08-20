import { useEffect, useRef, useState } from "react";
import DashboardOverview from "../components/Dashboard/DashboardOverview/DashboardOverview";
import { preloadProductsViaFetch as preloadProductsToIndexedDb } from "../utils/cacheDbPreload";

const Dashboard = ({ navigate }) => {
  const preloadRef = useRef(false);
  const [isDashboardOffline, setIsDashboardOffline] = useState(
    typeof window !== "undefined" && window.__serverOffline === true,
  );
  const [dashboardRetryKey, setDashboardRetryKey] = useState(0);

  useEffect(() => {
    console.log("[cacheDB] Dashboard.jsx mounted");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleServerStatus = (event) => {
      setIsDashboardOffline(event?.detail?.offline === true);
    };
    window.addEventListener("server-status", handleServerStatus);
    return () =>
      window.removeEventListener("server-status", handleServerStatus);
  }, []);

  useEffect(() => {
    console.log("[cacheDB] Dashboard.jsx preload check", {
      already: preloadRef.current,
    });
    if (preloadRef.current) return;
    preloadRef.current = true;
    console.log("[cacheDB] Dashboard.jsx preload start");
    preloadProductsToIndexedDb()
      .then(() => console.log("[cacheDB] Dashboard.jsx preload success"))
      .catch((err) => {
        console.error("[cacheDB] Dashboard.jsx preload failed", err);
      });
  }, []);

  const retryDashboard = () => {
    setIsDashboardOffline(false);
    setDashboardRetryKey((current) => current + 1);
  };

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
        {isDashboardOffline && (
          <div
            className="alert alert-warning d-flex align-items-center justify-content-between gap-3"
            role="alert"
            aria-live="assertive"
          >
            <span>
              Dashboard data is unavailable because Central cannot be reached.
            </span>
            <button
              type="button"
              className="btn btn-sm btn-outline-dark"
              onClick={retryDashboard}
            >
              Retry dashboard
            </button>
          </div>
        )}
        <DashboardOverview key={dashboardRetryKey} navigate={navigate}/>
      </div>
    </div>
  );
};

export default Dashboard;
