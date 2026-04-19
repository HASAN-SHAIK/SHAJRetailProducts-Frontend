import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../../utils/axios';
import LoadingSpinner from './LoadingSpinner/LoadingSpinner';
import { useDispatch } from 'react-redux';
import { setUserDetails } from '../../store/userSlice';
import { clearTenantState } from '../../store/tenantSlice';
import { useSelector } from 'react-redux';
import { getSessionInfo } from '../../utils/sessionStorage';
const ProtectedRoute = ({ children }) => {
  const [isAuth, setIsAuth] = useState(null);
  const [authMode, setAuthMode] = useState('online');
  const dispatch = useDispatch();
  const subscriptionStatus = useSelector((state) => state.tenant.subscriptionStatus);
  const tenantConfigStatus = useSelector((state) => state.tenant.configStatus);
  const userDetails = useSelector((state) => state.user.userDetails);
  useEffect(() => {
    let active = true;
    const verifyAccess = async () => {
      try {
        await api.get('/auth/getLogin');
        if (!active) return;
        setAuthMode('online');
        setIsAuth(true);
      } catch (err) {
        if (!active) return;
        const status = err?.response?.status;
        if (status === 403) {
          setAuthMode('online');
          setIsAuth(true);
          return;
        }
        const networkDown = status === 0 || err?.isNetworkError || !navigator.onLine;
        if (networkDown) {
          const session = await getSessionInfo().catch(() => null);
          const localUser = userDetails || session?.user || null;
          if (localUser) {
            if (!userDetails) {
              dispatch(setUserDetails(localUser));
            }
            setAuthMode('offline');
            setIsAuth(true);
            return;
          }
        }
        setAuthMode('online');
        setIsAuth(false);
      }
    };
    verifyAccess();
    return () => {
      active = false;
    };
  }, [dispatch, userDetails]);

  if (isAuth === null || tenantConfigStatus === 'loading') return <LoadingSpinner />;
  if (!isAuth){ 
    dispatch(setUserDetails(null));
    dispatch(clearTenantState());
    return <Navigate to="/" />;
  }
  if (authMode !== 'offline' && (subscriptionStatus === 'expired' || subscriptionStatus === 'inactive')) {
    return <Navigate to="/subscription-expired" replace />;
  }
  return children;
};

export default ProtectedRoute;
