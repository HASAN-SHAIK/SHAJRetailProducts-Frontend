// src/pages/Logout.js
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { clearUserDetails } from '../store/userSlice';
import Cookies from 'js-cookie';
import api from '../utils/axios';
import LoadingSpinner from '../components/common/LoadingSpinner/LoadingSpinner';
import { clearOrderDetails } from '../store/orderSlice';
import { usePopup } from '../components/common/PopUp/PopupProvider';

const Logout = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { showPopup } = usePopup();
  useEffect(() => {

    const logoutUser = async () => {
    try{
      const response = await api.post('/auth/logout');
      dispatch(clearUserDetails());
      dispatch(clearOrderDetails());
      Cookies.remove('token');
      try {
        localStorage.removeItem('auth_token');
      } catch (err) {
        // Ignore storage failures
      }
    }
    catch (error) {
      showPopup('Logout failed. Please try again.', 'Error');
       console.error('Logout error:', error);
    }
    finally {
      navigate('/login');
    }
  }
    logoutUser();
    // Navigate to login
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
      <div className="wow-content d-flex justify-content-center align-items-center vh-100">
        <div className="text-center">
          <LoadingSpinner />
          <p className="fw-bold text-light">Logging you out...</p>
        </div>
      </div>
    </div>
  );
};

export default Logout;
