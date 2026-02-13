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

function App() {
  const authPages = ['/', '/register', '/logout'];
  const userDetails = useSelector((state) => state.user.userDetails);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [serverOffline, setServerOffline] = useState(
    typeof window !== 'undefined' && window.__serverOffline === true
  );
  const navigate = useNavigate();
const dispatch = useDispatch();
  const location = useLocation();

useEffect(() => {
  const checkSession = async () => {
    try {
      if (!navigator.onLine) return;
      const res = await api.get('/auth/getLogin');
      dispatch(setUserDetails(res.data.user)); // optional (for username)
    } catch (err) {
      if (!navigator.onLine) return;
      console.error('Session check failed:', err);
      navigate('/logout');
    }
  };
  checkSession();
}, []);

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

const showServerDownBanner = !isOnline || serverOffline;
  return (
    <>
      {userDetails && !authPages.includes(location.pathname) && 
      <div className='sticky-top'>
        <Navbar user_name={userDetails && userDetails.user_name} />
        
      </div>}
      {showServerDownBanner && (
        <div className="server-down-banner">
          Server is Offline
        </div>
      )}
      <Routes>
        <Route path="/" element={<LoginPage navigate={navigate} />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <ThemeProvider>
                <Dashboard navigate={navigate} />
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
          path='/logout'
          element={
            <ProtectedRoute>
              <Logout />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={userDetails ? <Navigate to="/dashboard" replace /> : <Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
