import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import ProtectedRoute from './components/common/protectedRoute';
import { ThemeProvider } from './ThemeContext';
import Orders from './pages/Orders';
import Expenses from './pages/Expenses';
import Navbar from './components/common/Navbar/Navbar';
import { useEffect, useRef, useState } from 'react';
import ProductsPage from './components/ProductsPage';
import Transactions from './pages/Transactions';
import CreateOrderPage from './pages/CreateOrderPage';
import './App.css';
import { useDispatch, useSelector } from 'react-redux';
import Logout from './pages/Logout';
import Footer from './components/Footer/Footer';
import { setUserDetails } from './store/userSlice';
import api from './utils/axios';
import { preloadAllCaches, preloadProductsToIndexedDb } from './utils/indexedDb';
import { processOfflineQueue } from './utils/offlineOrders';
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
import BillingPage from './pages/BillingPage';
// import BillingModule from './modules/billing';
import BranchDevices from './pages/BranchDevices';

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [serverOffline, setServerOffline] = useState(
    typeof window !== 'undefined' && window.__serverOffline === true
  );
  const [tenantBanner, setTenantBanner] = useState(null);
  const bannerFetchRef = useRef({ userId: null, inFlight: false });
  const preloadOnceRef = useRef(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const location = useLocation();
  const { showPopup } = usePopup();
  const setWhatsappEnabled = useWhatsappStore((state) => state.setWhatsappEnabled);
  const setBranches = useBranchStore((state) => state.setBranches);
  const selectedBranchId = useBranchStore((state) => state.selectedBranchId);
  const setSelectedBranchId = useBranchStore((state) => state.setSelectedBranchId);
  const planFeatures = tenantConfig?.plan_features || tenantConfig || {};
  const isMobileRoute = location.pathname.startsWith('/m');
  const isMobileDevice =
    typeof window !== 'undefined' &&
    (window.matchMedia('(max-width: 768px)').matches ||
      /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
  const reportsEnabled =
    planFeatures.advanced_reports === true ||
    planFeatures.analytical_reports === true ||
    tenantConfig?.enable_reports !== false;

useEffect(() => {
  const checkSession = async () => {
    try {
      if (!navigator.onLine) return;
      if (AUTH_PAGES.includes(location.pathname)) return;
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
  preloadOnceRef.current = true;
  preloadAllCaches().catch((err) => {
    console.error('IndexedDB preload failed', err);
  });
}, [location.pathname]);

useEffect(() => {
  if (!userDetails) return;
  if (!isMobileDevice) return;
  if (isMobileRoute) return;
  if (AUTH_PAGES.includes(location.pathname)) return;
  if (location.pathname === '/subscription-expired') return;
  navigate('/m/dashboard', { replace: true });
}, [userDetails, isMobileDevice, isMobileRoute, location.pathname, navigate]);

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
    if (!userDetails) return;
    if (!navigator.onLine) return;
    try {
      const payload = await getSettings();
      const features = payload?.plan_features || payload?.features || payload || {};
      setWhatsappEnabled(
        payload?.whatsapp_bill_module === true ||
        features?.whatsapp_bill_module === true ||
        features?.WHATSAPP_BILL === true
      );
    } catch (err) {
      setWhatsappEnabled(false);
    }
  };
  fetchSettings();
}, [userDetails, setWhatsappEnabled]);

useEffect(() => {
  const fetchBranches = async () => {
    if (!userDetails) return;
    if (!navigator.onLine) return;
    try {
      const payload = await getBranches();
      const list = payload?.branches || payload?.data?.branches || payload?.data || [];
      const branches = Array.isArray(list) ? list : [];
      setBranches(branches);
      if (!selectedBranchId && branches.length > 0) {
        if (userDetails?.role === 'admin') {
          setSelectedBranchId('all');
        } else {
          setSelectedBranchId(branches[0].id);
        }
      }
    } catch (err) {
      setBranches([]);
    }
  };
  fetchBranches();
}, [userDetails, selectedBranchId, setBranches, setSelectedBranchId]);

useEffect(() => {
  const registerDeviceForBranch = async () => {
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
  const features = tenantConfig?.plan_features || tenantConfig?.features || tenantConfig || {};
  if (features?.WHATSAPP_BILL === true || features?.whatsapp_bill_module === true) {
    setWhatsappEnabled(true);
  }
}, [tenantConfig, setWhatsappEnabled]);

useEffect(() => {
  const fetchTenantBanner = async () => {
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
  const syncOfflineOrders = async () => {
    if (!navigator.onLine) return;
    try {
      await processOfflineQueue(api);
    } catch (err) {
      console.log('Offline order sync failed', err);
    }
  };
  syncOfflineOrders();
  window.addEventListener('online', syncOfflineOrders);
  return () => window.removeEventListener('online', syncOfflineOrders);
}, []);

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
    preloadAllCaches().catch((err) => {
      console.error('IndexedDB preload failed', err);
    });
    };
    window.addEventListener('login-success', handleLoginSuccess);
    return () => window.removeEventListener('login-success', handleLoginSuccess);
  }, []);

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
const showTenantBanner = tenantBanner?.enabled === true;
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
    <>
      <ScrollToTop />
      {userDetails && !AUTH_PAGES.includes(location.pathname) && 
      !isMobileRoute && (
        <div className='sticky-top'>
          <Navbar user_name={userDetails && userDetails.user_name} />
        </div>
      )}
      {showServerDownBanner && (
        <div className="server-offline-indicator" title="Server is offline. You can still place orders at the same speed.">
          <span className="server-offline-dot" />
          <span className="server-offline-text">Offline Mode</span>
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
        <Route path="/subscription-expired" element={<SubscriptionExpired />} />
        <Route
          path="/m"
          element={<Navigate to="/m/dashboard" replace />}
        />
        <Route
          path="/m/dashboard"
          element={
            <ProtectedRoute>
              <DashboardMobile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/m/orders"
          element={
            <ProtectedRoute>
              <OrdersMobile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/m/orders/:id"
          element={
            <ProtectedRoute>
              <OrderDetailsMobile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/m/products"
          element={
            <ProtectedRoute>
              <ProductsMobile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/m/reports"
          element={
            <ProtectedRoute>
              <ReportsMobile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/m/settings"
          element={
            <ProtectedRoute>
              <SettingsMobile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <ThemeProvider>
                {reportsEnabled ? <Dashboard navigate={navigate} /> : <Navigate to="/neworder" replace />}
              </ThemeProvider>
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
          path="/expenses"
          element={
            <ProtectedRoute>
              <Expenses />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute>
              <ProductsPage navigate={navigate} userRole={userDetails && userDetails.role} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/transactions"
          element={
            <ProtectedRoute>
              <Transactions navigate={navigate} userRole={userDetails && userDetails.role} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/neworder"
          element={
            <ProtectedRoute>
              <CreateOrderPage  />
            </ProtectedRoute>
          }
        />
        <Route
          path="/billing"
          element={
            <ProtectedRoute>
              <BillingPage navigate={navigate} />
            </ProtectedRoute>
          }
        />
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
    </>
  );
}

export default App;
