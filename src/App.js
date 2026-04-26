import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import ProtectedRoute from './components/common/protectedRoute';
import { ThemeProvider } from './ThemeContext';
import Orders from './pages/Orders';
import Navbar from './components/common/Navbar/Navbar';
import { useEffect, useRef, useState } from 'react';
import './App.css';
import { useDispatch, useSelector } from 'react-redux';
import Logout from './pages/Logout';
import { setUserDetails } from './store/userSlice';
import api from './utils/axios';
import { preloadAllCaches } from './utils/indexedDb';
import { startImportSyncWorker, stopImportSyncWorker } from './utils/importSync';
import { startCustomerSyncWorker, stopCustomerSyncWorker } from './utils/customersSync';
import { startInventorySyncWorker, stopInventorySyncWorker } from './utils/inventorySync';
import { setTenantConfig, setTenantConfigStatus, setSubscriptionStatus, setTenantIdentity } from './store/tenantSlice';
import SubscriptionExpired from './pages/SubscriptionExpired';
import { decodeJwtPayload } from './utils/jwt';
import { getAuthToken, migrateAuthTokenFromLocalStorage } from './utils/sessionStorage';
import Support from './pages/Support';
import { usePopup } from './components/common/PopUp/PopupProvider';
import { getSettings } from './services/settingsService';
import { resolveTenantConfig } from './services/tenantService';
import { useWhatsappStore } from './store/whatsappStore';
import { getBranches } from './services/branchService';
import { useBranchStore } from './store/branchStore';
import DashboardMobile from './mobile/pages/DashboardMobile';
import OrdersMobile from './mobile/pages/OrdersMobile';
import OrderDetailsMobile from './mobile/pages/OrderDetailsMobile';
import ProductsMobile from './mobile/pages/ProductsMobile';
import ReportsMobile from './mobile/pages/ReportsMobile';
import SettingsMobile from './mobile/pages/SettingsMobile';
import BillingMobile from './mobile/pages/BillingMobile';
import ContextLayout from './components/layout/ContextLayout';
import RetailBilling from './pages/billing/RetailBilling';
import WholesaleBilling from './pages/billing/WholesaleBilling';
import StaffList from './pages/staffExpenses/StaffList';
import StaffForm from './pages/staffExpenses/StaffForm';
import SalaryTracking from './pages/staffExpenses/SalaryTracking';
import ExpenseAdd from './pages/staffExpenses/ExpenseAdd';
import ExpenseDailyReport from './pages/staffExpenses/ExpenseDailyReport';
import ExpenseMonthlyReport from './pages/staffExpenses/ExpenseMonthlyReport';
import ExpenseStaffReport from './pages/staffExpenses/ExpenseStaffReport';
import SalesReturn from './pages/returnsCorrections/SalesReturn';
import ReturnHistory from './pages/returnsCorrections/ReturnHistory';
import EditBill from './pages/returnsCorrections/EditBill';
import CorrectionHistory from './pages/returnsCorrections/CorrectionHistory';
import TaxReports from './pages/returnsCorrections/TaxReports';
import GstSummary from './pages/returnsCorrections/GstSummary';
import EwayBill from './pages/returnsCorrections/EwayBill';
import GstFilingData from './pages/returnsCorrections/GstFilingData';
import ProductCatalog from './pages/inventory/ProductCatalog';
import Purchase from './pages/inventory/Purchase';
import PurchaseBook from './pages/inventory/PurchaseBook';
import PurchaseDetail from './pages/inventory/PurchaseDetail';
import PurchaseReturn from './pages/inventory/PurchaseReturn';
import Suppliers from './pages/inventory/Suppliers';
import SupplierForm from './pages/inventory/SupplierForm';
import SupplierDetail from './pages/inventory/SupplierDetail';
import CustomerList from './pages/customers/CustomerList';
import CustomerForm from './pages/customers/CustomerForm';
import CustomerDetail from './pages/customers/CustomerDetail';
import CustomerReorder from './pages/customers/CustomerReorder';
import ReceiptEntry from './pages/accounts/ReceiptEntry';
import PaymentEntry from './pages/accounts/PaymentEntry';
import CashBook from './pages/accounts/CashBook';
import BankBook from './pages/accounts/BankBook';
import Ledger from './pages/accounts/Ledger';
import Outstanding from './pages/accounts/Outstanding';
// import BillingModule from './modules/billing';
import BranchDevices from './pages/BranchDevices';
import SetupScreen from './pages/SetupScreen';
import { startDefaultOfflineSync, stopDefaultOfflineSync } from './offline-sync';
import SyncCenter from './pages/SyncCenter';
import { hasFeature, isFeatureEnabled } from './utils/entitlements';
import { runAppSyncCycle } from './utils/appSyncOrchestrator';

const AUTH_PAGES = ['/', '/register', '/logout'];

const ScrollToTop = () => {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return null;
};

function App() {
  const userDetails = useSelector((state) => state.user.userDetails);
  const tenantConfig = useSelector((state) => state.tenant.tenantConfig);
  const tenantConfigStatus = useSelector((state) => state.tenant.configStatus);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [serverOffline, setServerOffline] = useState(
    typeof window !== 'undefined' && window.__serverOffline === true
  );
  const [setupInProgress, setSetupInProgress] = useState(false);
  const [setupReady, setSetupReady] = useState(false);
  const [tenantBanner, setTenantBanner] = useState(null);
  const bannerFetchRef = useRef({ userId: null, inFlight: false });
  const preloadOnceRef = useRef(false);
  const setupInProgressRef = useRef(false);
  const setupDidRunRef = useRef(false);
  const initialSyncDoneRef = useRef(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const location = useLocation();
  const { showPopup } = usePopup();
  const setWhatsappEnabled = useWhatsappStore((state) => state.setWhatsappEnabled);
  const setBranches = useBranchStore((state) => state.setBranches);
  const selectedBranchId = useBranchStore((state) => state.selectedBranchId);
  const setSelectedBranchId = useBranchStore((state) => state.setSelectedBranchId);
  const hasAllBranchAccess =
    String(userDetails?.role || '').toLowerCase() === 'admin' ||
    userDetails?.all_branch_access !== false;
  const restrictedBranchId =
    userDetails?.all_branch_access === false && userDetails?.branch_id
      ? String(userDetails.branch_id)
      : null;
  const isMobileRoute = location.pathname.startsWith('/m');
  const isMobileDevice =
    typeof window !== 'undefined' &&
    (window.matchMedia('(max-width: 768px)').matches ||
      /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
  const reportsEnabled = isFeatureEnabled(tenantConfig, 'reports_enabled', true);
  const mobileAccessEnabled = isFeatureEnabled(tenantConfig, 'mobile_access', false);
  const canUseMobileRoutes = tenantConfigStatus === 'loaded' ? mobileAccessEnabled : true;
  useEffect(() => {
    const runSetup = async () => {
      if (!userDetails) {
        setSetupReady(false);
        setupDidRunRef.current = false;
        return;
      }
      if (AUTH_PAGES.includes(location.pathname)) return;
      if (location.pathname === '/subscription-expired') return;
      if (location.pathname !== '/setup') return;
      if (setupInProgressRef.current || setupDidRunRef.current) return;
      setupInProgressRef.current = true;
      setupDidRunRef.current = true;
      setSetupInProgress(true);
      let setupMobileAccessEnabled = false;
      try {
        await preloadAllCaches().catch((err) => {
          console.error('IndexedDB preload failed', err);
        });

        if (tenantConfigStatus !== 'loading' && tenantConfigStatus !== 'loaded') {
          dispatch(setTenantConfigStatus('loading'));
        }
        try {
          const payload = await resolveTenantConfig();
          setupMobileAccessEnabled = hasFeature(payload, 'mobile_access');
          dispatch(setTenantConfig(payload));
          if (payload.subscription_status || payload.subscriptionStatus) {
            dispatch(setSubscriptionStatus(payload.subscription_status || payload.subscriptionStatus));
          }
        } catch (err) {
          const code = err?.response?.data?.code;
          if (code === 'SUBSCRIPTION_INACTIVE') {
            dispatch(setSubscriptionStatus('inactive'));
            dispatch(setTenantConfigStatus('loaded'));
            dispatch(setTenantConfig(null));
          } else {
            dispatch(setTenantConfigStatus('error'));
            console.error('Failed to fetch tenant config', err);
          }
        }

        if (navigator.onLine) {
          try {
            const payload = await getSettings();
            setWhatsappEnabled(hasFeature(payload, 'whatsapp_bill_enabled'));
          } catch {
            setWhatsappEnabled(false);
          }
        }

        let branchIdForSync = selectedBranchId;
        if (navigator.onLine) {
          try {
            const payload = await getBranches();
            const list = payload?.branches || payload?.data?.branches || payload?.data || [];
            const branches = Array.isArray(list) ? list : [];
            setBranches(branches);
            const restrictedBranch = restrictedBranchId
              ? branches.find((branch) => String(branch?.id) === restrictedBranchId)
              : null;
            if (restrictedBranch) {
              if (String(selectedBranchId || '') !== restrictedBranchId) {
                setSelectedBranchId(restrictedBranchId, {
                  confirmed: false,
                  name: restrictedBranch?.name || ''
                });
              }
              branchIdForSync = restrictedBranchId;
            } else if (!selectedBranchId && branches.length > 0) {
              if (hasAllBranchAccess) {
                setSelectedBranchId('all', { confirmed: false, name: 'All' });
                branchIdForSync = 'all';
              } else {
                setSelectedBranchId(branches[0].id, {
                  confirmed: false,
                  name: branches[0]?.name || ''
                });
                branchIdForSync = branches[0].id;
              }
            }
          } catch {
            // keep previous branches on error
          }
        }

        if (navigator.onLine && branchIdForSync && branchIdForSync !== 'all') {
          try {
            await api.get('/auth/getLogin');
          } catch {
            // handled by interceptors
          }
        }

        if (navigator.onLine && userDetails?.id) {
          try {
            const res = await api.get('/banner');
            const payload = res?.data?.data || res?.data || {};
            const rawDaysLeft = payload.days_left ?? payload.daysLeft;
            const parsedDaysLeft = rawDaysLeft === null || rawDaysLeft === undefined ? null : Number(rawDaysLeft);
            setTenantBanner({
              enabled: payload.show_banner === true || payload.showBanner === true,
              color: payload.bannerColor || payload.color || null,
              daysLeft: Number.isFinite(parsedDaysLeft) ? parsedDaysLeft : null,
            });
          } catch (err) {
            console.error('Failed to fetch tenant banner', err);
            setTenantBanner(null);
          }
        }

        if (navigator.onLine) {
          try {
            await runAppSyncCycle({
              tenantId: userDetails?.tenant_id,
              userId: userDetails?.id,
              branchId: branchIdForSync,
              forceFull: false,
            });
            initialSyncDoneRef.current = true;
          } catch (err) {
            console.log('Offline order sync failed', err);
          }
        }
      } finally {
        setSetupInProgress(false);
        setSetupReady(true);
        setupInProgressRef.current = false;
        navigate(isMobileDevice && setupMobileAccessEnabled ? '/m/dashboard' : '/dashboard', { replace: true });
      }
    };
    runSetup();
  }, [
    userDetails,
    location.pathname,
    tenantConfigStatus,
    dispatch,
    setWhatsappEnabled,
    setBranches,
    setSelectedBranchId,
    selectedBranchId,
    hasAllBranchAccess,
    restrictedBranchId,
    isMobileDevice,
    navigate,
  ]);

  useEffect(() => {
    const checkSession = async () => {
      try {
        if (setupInProgress || setupDidRunRef.current) return;
        if (!navigator.onLine) return;
        if (AUTH_PAGES.includes(location.pathname)) return;
        if (location.pathname === '/setup') return;
        const res = await api.get('/auth/getLogin');
        dispatch(setUserDetails(res.data.user)); // optional (for username)
        if (res?.data?.user) {
        dispatch(setTenantIdentity({
          tenantId: res.data.user.tenant_id,
          role: res.data.user.role,
          userId: res.data.user.id,
        }));
      }
    } catch (err) {
      if (!navigator.onLine) return;
      const status = err?.response?.status;
      if (status === 401) {
        console.error('Session check failed:', err);
        if (!AUTH_PAGES.includes(location.pathname)) {
          navigate('/logout');
        }
      } else {
        console.error('Session check failed:', err);
      }
    }
  };
  checkSession();
}, [dispatch, location.pathname, navigate]);

  useEffect(() => {
    if (!location.pathname.startsWith('/dashboard')) return;
    if (preloadOnceRef.current) return;
    if (setupInProgress) return;
    preloadOnceRef.current = true;
  preloadAllCaches().catch((err) => {
    console.error('IndexedDB preload failed', err);
  });
}, [location.pathname]);

useEffect(() => {
  if (!userDetails) return;
  if (!isMobileDevice) return;
  if (!mobileAccessEnabled) return;
  if (isMobileRoute) return;
  if (location.pathname === '/setup') return;
  if (AUTH_PAGES.includes(location.pathname)) return;
  if (location.pathname === '/subscription-expired') return;
  navigate('/m/dashboard', { replace: true });
}, [userDetails, isMobileDevice, mobileAccessEnabled, isMobileRoute, location.pathname, navigate]);

useEffect(() => {
  if (!userDetails) return;
  if (!isMobileRoute) return;
  if (tenantConfigStatus !== 'loaded') return;
  if (mobileAccessEnabled) return;
  navigate('/dashboard', { replace: true });
}, [userDetails, isMobileRoute, tenantConfigStatus, mobileAccessEnabled, navigate]);

useEffect(() => {
  if (typeof window === 'undefined') return;
  let active = true;
  const loadToken = async () => {
    try {
      await migrateAuthTokenFromLocalStorage();
      const token = await getAuthToken();
      const decoded = decodeJwtPayload(token);
      if (decoded && active) {
        dispatch(setTenantIdentity({
          tenantId: decoded.tenant_id,
          role: decoded.role,
          userId: decoded.user_id,
        }));
      }
    } catch (err) {
      // ignore
    }
  };
  loadToken();
  return () => {
    active = false;
  };
}, [dispatch]);

useEffect(() => {
  const fetchTenantConfig = async () => {
    if (setupInProgress || setupDidRunRef.current) return;
    if (!userDetails || tenantConfigStatus === 'loading' || tenantConfigStatus === 'loaded') return;
    dispatch(setTenantConfigStatus('loading'));
    try {
        const payload = await resolveTenantConfig();
        dispatch(setTenantConfig(payload));
        if (payload.subscription_status || payload.subscriptionStatus) {
          dispatch(setSubscriptionStatus(payload.subscription_status || payload.subscriptionStatus));
        }
      } catch (err) {
        const code = err?.response?.data?.code;
        if (code === 'SUBSCRIPTION_INACTIVE') {
          dispatch(setSubscriptionStatus('inactive'));
          dispatch(setTenantConfigStatus('loaded'));
          dispatch(setTenantConfig(null));
        } else {
          dispatch(setTenantConfigStatus('error'));
          console.error('Failed to fetch tenant config', err);
        }
    }
  };
  fetchTenantConfig();
}, [userDetails, tenantConfigStatus, dispatch]);

useEffect(() => {
  const fetchSettings = async () => {
    if (setupInProgress || setupDidRunRef.current) return;
    if (!userDetails) return;
    if (!navigator.onLine) return;
    try {
      const payload = await getSettings();
      setWhatsappEnabled(hasFeature(payload, 'whatsapp_bill_enabled'));
    } catch (err) {
      setWhatsappEnabled(false);
    }
  };
  fetchSettings();
}, [userDetails, setWhatsappEnabled]);

useEffect(() => {
  const fetchBranches = async () => {
    if (setupInProgress || setupDidRunRef.current) return;
    if (!userDetails) return;
    if (!navigator.onLine) return;
    try {
      const payload = await getBranches();
      const list = payload?.branches || payload?.data?.branches || payload?.data || [];
      const branches = Array.isArray(list) ? list : [];
      setBranches(branches);
      const restrictedBranch = restrictedBranchId
        ? branches.find((branch) => String(branch?.id) === restrictedBranchId)
        : null;
      if (restrictedBranch) {
        if (String(selectedBranchId || '') !== restrictedBranchId) {
          setSelectedBranchId(restrictedBranchId, {
            confirmed: false,
            name: restrictedBranch?.name || ''
          });
        }
      } else if (!selectedBranchId && branches.length > 0) {
        if (hasAllBranchAccess) {
          setSelectedBranchId('all', { confirmed: false, name: 'All' });
        } else {
          setSelectedBranchId(branches[0].id, {
            confirmed: false,
            name: branches[0]?.name || ''
          });
        }
      }
    } catch (err) {
      // Keep previous branches on error to avoid flicker/reset.
    }
  };
  fetchBranches();
}, [userDetails, selectedBranchId, setBranches, setSelectedBranchId, hasAllBranchAccess, restrictedBranchId]);

useEffect(() => {
  const registerDeviceForBranch = async () => {
    if (setupInProgress || setupDidRunRef.current) return;
    if (!userDetails) return;
    if (!navigator.onLine) return;
    if (!selectedBranchId || selectedBranchId === 'all') return;
    try {
      await api.get('/auth/getLogin');
    } catch (err) {
      // handled by axios interceptors
    }
  };
  registerDeviceForBranch();
}, [userDetails, selectedBranchId]);

useEffect(() => {
  if (!tenantConfig) return;
  if (setupInProgress) return;
  if (hasFeature(tenantConfig, 'whatsapp_bill_enabled')) {
    setWhatsappEnabled(true);
  }
}, [tenantConfig, setWhatsappEnabled]);

useEffect(() => {
  const fetchTenantBanner = async () => {
    if (setupInProgress || setupDidRunRef.current) return;
    const userId = userDetails?.id;
    if (!userId || !navigator.onLine) return;
    if (bannerFetchRef.current.inFlight) return;
    if (bannerFetchRef.current.userId === userId) return;
    bannerFetchRef.current = { userId, inFlight: true };
    try {
      const res = await api.get('/banner');
      const payload = res?.data?.data || res?.data || {};
      const rawDaysLeft = payload.days_left ?? payload.daysLeft;
      const parsedDaysLeft = rawDaysLeft === null || rawDaysLeft === undefined ? null : Number(rawDaysLeft);
      setTenantBanner({
        enabled: payload.show_banner === true || payload.showBanner === true,
        color: payload.bannerColor || payload.color || null,
        daysLeft: Number.isFinite(parsedDaysLeft) ? parsedDaysLeft : null,
      });
    } catch (err) {
      console.error('Failed to fetch tenant banner', err);
      setTenantBanner(null);
    } finally {
      bannerFetchRef.current.inFlight = false;
    }
  };
  fetchTenantBanner();
}, [userDetails?.id]);

  useEffect(() => {
  let orderSyncInFlight = false;
  const syncOfflineOrders = async () => {
    if (!navigator.onLine) return;
    if (orderSyncInFlight) return;
    orderSyncInFlight = true;
    try {
      await runAppSyncCycle({
        tenantId: userDetails?.tenant_id,
        userId: userDetails?.id,
        branchId: selectedBranchId,
        forceFull: false,
      });
    } catch (err) {
      console.log('Offline order sync failed', err);
    } finally {
      orderSyncInFlight = false;
    }
  };
  let syncInterval = null;
  if (!setupReady) return undefined;
  if (!initialSyncDoneRef.current) {
    syncOfflineOrders();
  }
  const handleQueueEnqueued = () => {
    syncOfflineOrders();
  };
  window.addEventListener('online', syncOfflineOrders);
  window.addEventListener('offline-order-enqueued', handleQueueEnqueued);
  syncInterval = setInterval(syncOfflineOrders, 15000);
  startInventorySyncWorker();
  startImportSyncWorker();
  startCustomerSyncWorker();
  return () => {
    window.removeEventListener('online', syncOfflineOrders);
    window.removeEventListener('offline-order-enqueued', handleQueueEnqueued);
    if (syncInterval) {
      clearInterval(syncInterval);
    }
    stopInventorySyncWorker();
    stopImportSyncWorker();
    stopCustomerSyncWorker();
  };
}, [selectedBranchId, setupReady, userDetails?.id, userDetails?.tenant_id]);

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

useEffect(() => {
  const handleLoginSuccess = () => {
    if (setupInProgress || setupDidRunRef.current) return;
    preloadAllCaches().catch((err) => {
      console.error('IndexedDB preload failed', err);
    });
    };
    window.addEventListener('login-success', handleLoginSuccess);
    return () => window.removeEventListener('login-success', handleLoginSuccess);
  }, []);

useEffect(() => {
  if (!setupReady) return;
  startDefaultOfflineSync();
  return () => {
    stopDefaultOfflineSync();
  };
}, [setupReady]);

useEffect(() => {
  const handleServerStatus = (event) => {
    if (event?.detail && typeof event.detail.offline === 'boolean') {
      setServerOffline(event.detail.offline);
    }
  };
  window.addEventListener('server-status', handleServerStatus);
  if (typeof window !== 'undefined' && window.__serverOffline === true) {
    setServerOffline(true);
  }
  return () => window.removeEventListener('server-status', handleServerStatus);
}, []);

useEffect(() => {
  const handleAuthExpired = () => {
    if (!AUTH_PAGES.includes(location.pathname)) {
      navigate('/logout');
    }
  };
  const handleSubscriptionExpired = () => {
    navigate('/subscription-expired');
  };
  const handleForbidden = (event) => {
    const message = event?.detail?.message || 'Admin access only';
    showPopup(message, 'Access');
  };
  window.addEventListener('auth-expired', handleAuthExpired);
  window.addEventListener('subscription-expired', handleSubscriptionExpired);
  window.addEventListener('forbidden', handleForbidden);
  return () => {
    window.removeEventListener('auth-expired', handleAuthExpired);
    window.removeEventListener('subscription-expired', handleSubscriptionExpired);
    window.removeEventListener('forbidden', handleForbidden);
  };
}, [location.pathname, navigate, showPopup]);

const showServerDownBanner = !isOnline || serverOffline;
const showTenantBanner = tenantBanner?.enabled === true && location.pathname === '/dashboard';
const tenantBannerDays = Number.isFinite(tenantBanner?.daysLeft) ? tenantBanner.daysLeft : null;
const tenantBannerColor = (() => {
  if (tenantBannerDays !== null) {
    if (tenantBannerDays <= 3) return '#ef4444';
    if (tenantBannerDays <= 5) return '#f97316';
    if (tenantBannerDays < 7) return '#f59e0b';
  }
  return tenantBanner?.color || null;
})();
  return (
    <ThemeProvider>
      <ScrollToTop />
      {userDetails && !AUTH_PAGES.includes(location.pathname) && 
      !isMobileRoute && !setupInProgress && location.pathname !== '/setup' && (
        <div className='sticky-top'>
          <Navbar user_name={userDetails && userDetails.user_name} />
        </div>
      )}
      <div
        className={
          userDetails && !AUTH_PAGES.includes(location.pathname) && !isMobileRoute
            ? 'app-content'
            : undefined
        }
      >
          {showServerDownBanner && (
            <div className="server-offline-indicator" title="Server is offline. You can still place orders at the same speed.">
              <span className="server-offline-dot" />
            </div>
          )}
        {showTenantBanner && (
          <div
            className="tenant-status-banner"
            style={
              tenantBannerColor
                ? { background: tenantBannerColor, backgroundImage: 'none' }
                : undefined
            }
          >
            {tenantBannerDays === null
              ? 'Subscription status notice'
              : `Your subscription will expire in ${tenantBannerDays} day${tenantBannerDays === 1 ? '' : 's'}.`}
          </div>
        )}
        <Routes>
          <Route path="/" element={<LoginPage navigate={navigate} />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route
            path="/setup"
            element={
              <ProtectedRoute>
                <SetupScreen />
              </ProtectedRoute>
            }
          />
          <Route path="/subscription-expired" element={<SubscriptionExpired />} />
          <Route
            path="/m"
            element={<Navigate to="/m/dashboard" replace />}
          />
          <Route
            path="/m/dashboard"
            element={
              <ProtectedRoute>
                {canUseMobileRoutes ? <DashboardMobile /> : <Navigate to="/dashboard" replace />}
              </ProtectedRoute>
            }
          />
          <Route
            path="/m/orders"
            element={
              <ProtectedRoute>
                {canUseMobileRoutes ? <OrdersMobile /> : <Navigate to="/dashboard" replace />}
              </ProtectedRoute>
            }
          />
          <Route
            path="/m/orders/:id"
            element={
              <ProtectedRoute>
                {canUseMobileRoutes ? <OrderDetailsMobile /> : <Navigate to="/dashboard" replace />}
              </ProtectedRoute>
            }
          />
          <Route
            path="/m/billing"
            element={
              <ProtectedRoute>
                {canUseMobileRoutes ? <Navigate to="/m/neworder" replace /> : <Navigate to="/dashboard" replace />}
              </ProtectedRoute>
            }
          />
          <Route
            path="/m/neworder"
            element={
              <ProtectedRoute>
                {canUseMobileRoutes ? <BillingMobile /> : <Navigate to="/dashboard" replace />}
              </ProtectedRoute>
            }
          />
          <Route
            path="/m/products"
            element={
              <ProtectedRoute>
                {canUseMobileRoutes ? <ProductsMobile /> : <Navigate to="/dashboard" replace />}
              </ProtectedRoute>
            }
          />
          <Route
            path="/m/reports"
            element={
              <ProtectedRoute>
                {canUseMobileRoutes ? <ReportsMobile /> : <Navigate to="/dashboard" replace />}
              </ProtectedRoute>
            }
          />
          <Route
            path="/m/settings"
            element={
              <ProtectedRoute>
                {canUseMobileRoutes ? <SettingsMobile /> : <Navigate to="/dashboard" replace />}
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                {reportsEnabled ? <Dashboard navigate={navigate} /> : <Navigate to="/billing/retail" replace />}
              </ProtectedRoute>
            }
          />
          <Route
            path='/orders'
            element={
              <ProtectedRoute>
                <Orders navigate={navigate} userRole={userDetails && userDetails.role} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/products"
            element={
              <ProtectedRoute>
                <Navigate to="/inventory/catalog" replace />
              </ProtectedRoute>
            }
          />
          {/* <Route
            path="/transactions"
            element={
              <ProtectedRoute>
                <Transactions navigate={navigate} userRole={userDetails && userDetails.role} />
              </ProtectedRoute>
            }
          /> */}
          <Route
            element={
              <ProtectedRoute>
                <ContextLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/billing" element={<Navigate to="/billing/retail" replace />} />
            <Route path="/billing/retail" element={<RetailBilling />} />
            <Route path="/billing/wholesale" element={<WholesaleBilling />} />
            <Route path="/inventory" element={<Navigate to="/inventory/catalog" replace />} />
            <Route path="/staff-expenses" element={<Navigate to="/staff-expenses/staff/list" replace />} />
            <Route path="/returns-corrections" element={<Navigate to="/returns-corrections/returns/new" replace />} />
            <Route path="/accounts" element={<Navigate to="/accounts/receipt" replace />} />
            <Route
              path="/inventory/catalog"
              element={<ProductCatalog navigate={navigate} userRole={userDetails && userDetails.role} />}
            />
            <Route path="/staff-expenses/staff/list" element={<StaffList />} />
            <Route path="/staff-expenses/staff/add" element={<StaffForm />} />
            <Route path="/staff-expenses/staff/edit/:staffId" element={<StaffForm />} />
            <Route path="/staff-expenses/staff/salary" element={<SalaryTracking />} />
            <Route path="/staff-expenses/expenses/add" element={<ExpenseAdd />} />
            <Route path="/staff-expenses/expenses/daily" element={<ExpenseDailyReport />} />
            <Route path="/staff-expenses/expenses/monthly" element={<ExpenseMonthlyReport />} />
            <Route path="/staff-expenses/expenses/staff-wise" element={<ExpenseStaffReport />} />
            <Route path="/returns-corrections/returns/new" element={<SalesReturn />} />
            <Route path="/returns-corrections/returns/history" element={<ReturnHistory />} />
            <Route path="/returns-corrections/corrections/edit" element={<EditBill />} />
            <Route path="/returns-corrections/corrections/history" element={<CorrectionHistory />} />
            <Route path="/returns-corrections/gst/reports" element={<TaxReports />} />
            <Route path="/returns-corrections/gst/summary" element={<GstSummary />} />
            <Route path="/returns-corrections/gst/eway" element={<EwayBill />} />
            <Route path="/returns-corrections/gst/filing" element={<GstFilingData />} />
            <Route path="/inventory/purchase" element={<Purchase />} />
            <Route path="/inventory/purchases" element={<PurchaseBook />} />
            <Route path="/inventory/purchases/:id" element={<PurchaseDetail />} />
            <Route path="/inventory/purchase-returns" element={<PurchaseReturn />} />
            <Route path="/inventory/suppliers" element={<Suppliers />} />
            <Route path="/inventory/suppliers/new" element={<SupplierForm />} />
            <Route path="/inventory/suppliers/:id" element={<SupplierDetail />} />
            <Route path="/inventory/suppliers/:id/edit" element={<SupplierForm />} />
            <Route path="/accounts/receipt" element={<ReceiptEntry />} />
            <Route path="/accounts/payment" element={<PaymentEntry />} />
            <Route path="/accounts/cashbook" element={<CashBook />} />
            <Route path="/accounts/bankbook" element={<BankBook />} />
            <Route path="/accounts/ledger" element={<Ledger />} />
            <Route path="/accounts/outstanding" element={<Outstanding />} />
            <Route path="/customers" element={<CustomerList />} />
            <Route path="/customers/reorder" element={<CustomerReorder />} />
            <Route path="/customers/new" element={<CustomerForm />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
            <Route path="/customers/:id/edit" element={<CustomerForm />} />
            <Route path="/sync-center" element={<SyncCenter />} />
          </Route>
          {/* <Route
            path="/billing-new"
            element={
              <ProtectedRoute>
                <BillingModule />
              </ProtectedRoute>
            }
          /> */}
          <Route
            path="/branch-devices"
            element={
              <ProtectedRoute>
                <BranchDevices />
              </ProtectedRoute>
            }
          />
          <Route
            path="/support"
            element={
              <ProtectedRoute>
                <Support navigate={navigate} />
              </ProtectedRoute>
            }
          />
          <Route
            path='/logout'
            element={
              <Logout />
            }
          />
          <Route path="*" element={userDetails ? <Navigate to="/dashboard" replace /> : <Navigate to="/" replace />} />
        </Routes>
      </div>
    </ThemeProvider>
  );
}

export default App;
