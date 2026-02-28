import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../../utils/axios';
import LoadingSpinner from './LoadingSpinner/LoadingSpinner';
import { useDispatch } from 'react-redux';
import { setUserDetails } from '../../store/userSlice';
import { clearTenantState } from '../../store/tenantSlice';
import { useSelector } from 'react-redux';
const ProtectedRoute = ({ children }) => {
  const [isAuth, setIsAuth] = useState(null);
  const dispatch = useDispatch();
  const subscriptionStatus = useSelector((state) => state.tenant.subscriptionStatus);
  const tenantConfigStatus = useSelector((state) => state.tenant.configStatus);
  useEffect(() => {
    api.get('/auth/getLogin')
      .then(() => setIsAuth(true))
      .catch((err) => {
        const status = err?.response?.status;
        if (status === 403) {
          setIsAuth(true);
        } else {
          setIsAuth(false);
        }
      });
  }, []);

  if (isAuth === null || tenantConfigStatus === 'loading') return <LoadingSpinner />;
  if (!isAuth){ 
    dispatch(setUserDetails(null));
    dispatch(clearTenantState());
    return <Navigate to="/" />;
  }
  if (subscriptionStatus === 'expired' || subscriptionStatus === 'inactive') {
    return <Navigate to="/subscription-expired" replace />;
  }
  return children;
};

export default ProtectedRoute;
