import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../../utils/axios';
import LoadingSpinner from './LoadingSpinner/LoadingSpinner';
import { useDispatch } from 'react-redux';
import { setUserDetails } from '../../store/userSlice';
const ProtectedRoute = ({ children }) => {
  const [isAuth, setIsAuth] = useState(null);
  const dispatch = useDispatch();
  useEffect(() => {
    api.get('/auth/getLogin')
      .then(() => setIsAuth(true))
      .catch(() => setIsAuth(false));
  }, []);

  if (isAuth === null) return <LoadingSpinner />;
  if (!isAuth){ 
    dispatch(setUserDetails(null));
    return <Navigate to="/" />;}
  return children;
};

export default ProtectedRoute;
