import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import ProtectedRoute from './components/common/protectedRoute';
import { ThemeProvider } from './ThemeContext';
import Orders from './pages/Orders';
import Navbar from './components/common/Navbar/Navbar';
import { useEffect, useState } from 'react';
import ProductsPage from './components/ProductsPage/ProductsPage';
import Transactions from './pages/Transactions';
import CreateOrderPage from './pages/CreateOrderPage';
import './App.css';
import { useDispatch, useSelector } from 'react-redux';
import Logout from './pages/Logout';
import Footer from './components/Footer/Footer';
import { setUserDetails } from './store/userSlice';
import api from './utils/axios';
import { processOfflineQueue } from './utils/offlineOrders';
import { setTenantConfig, setTenantConfigStatus, setSubscriptionStatus, setTenantIdentity } from './store/tenantSlice';
import SubscriptionExpired from './pages/SubscriptionExpired';
import { decodeJwtPayload } from './utils/jwt';
import Support from './pages/Support';
import { usePopup } from './components/common/PopUp/PopupProvider';

function App() {
  const authPages = ['/', '/register', '/logout'];
  const userDetails = useSelector((state) => state.user.userDetails);
  const tenantConfig = useSelector((state) => state.tenant.tenantConfig);
  const tenantConfigStatus = useSelector((state) => state.tenant.configStatus);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [serverOffline, setServerOffline] = useState(
    typeof window !== 'undefined' && window.__serverOffline === true
  );
  const [tenantBanner, setTenantBanner] = useState(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const location = useLocation();
  const { showPopup } = usePopup();
  const planFeatures = tenantConfig?.plan_features || tenantConfig || {};
  const reportsEnabled =
    planFeatures.advanced_reports === true ||
    planFeatures.analytical_reports === true ||
    tenantConfig?.enable_reports !== false;

useEffect(() => {
  const checkSession = async () => {
    try {
      if (!navigator.onLine) return;
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
        navigate('/logout');
      } else {
        console.error('Session check failed:', err);
      }
    }
  };
  checkSession();
}, []);

useEffect(() => {
  if (typeof window === 'undefined') return;
  try {
    const token = localStorage.getItem('auth_token');
    const decoded = decodeJwtPayload(token);
    if (decoded) {
      dispatch(setTenantIdentity({
        tenantId: decoded.tenant_id,
        role: decoded.role,
        userId: decoded.user_id,
      }));
    }
  } catch (err) {
    // ignore
  }
}, [dispatch]);

  useEffect(() => {
    const fetchTenantConfig = async () => {
      if (!userDetails || tenantConfigStatus === 'loading' || tenantConfigStatus === 'loaded') return;
      dispatch(setTenantConfigStatus('loading'));
      try {
        const res = await api.get('/platform/config');
        const payload = res?.data?.data || res?.data || {};
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
  const fetchTenantBanner = async () => {
    if (!userDetails || !navigator.onLine) return;
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
  };
  fetchTenantBanner();
}, [userDetails]);

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
    navigate('/logout');
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
}, [navigate, showPopup]);

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
      {userDetails && !authPages.includes(location.pathname) && 
      <div className='sticky-top'>
        <Navbar user_name={userDetails && userDetails.user_name} />
        
      </div>}
      {showServerDownBanner && (
        <div className="server-down-banner">
          Server is Offline You Can Still Create Orders, But Sync Will Happen Once Server is Back Online
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
