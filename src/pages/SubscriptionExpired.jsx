import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setSubscriptionStatus, setTenantConfig } from '../store/tenantSlice';
import { fetchTenantConfig } from '../services/tenantService';

const SubscriptionExpired = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');

  const handleCheckAgain = async () => {
    setChecking(true);
    setMessage('');
    try {
      const payload = await fetchTenantConfig();
      const status = payload?.subscription_status || payload?.subscriptionStatus;
      dispatch(setTenantConfig(payload));
      dispatch(setSubscriptionStatus(status || null));
      if (status === 'active') {
        navigate('/dashboard', { replace: true });
        return;
      }
      setMessage('Subscription is still inactive.');
    } catch (error) {
      const code = error?.response?.data?.code;
      if (code === 'SUBSCRIPTION_INACTIVE' || code === 'SUBSCRIPTION_REQUIRED') {
        dispatch(setSubscriptionStatus('inactive'));
        setMessage('Subscription is still inactive.');
      } else {
        setMessage('Unable to check subscription right now.');
      }
    } finally {
      setChecking(false);
    }
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
      <div className="wow-content d-flex justify-content-center align-items-center vh-100">
        <div className="text-center">
          <h2 className="text-light mb-3">Subscription Expired</h2>
          <p className="text-light mb-4">
            Your subscription is not active. Please contact support to renew access.
          </p>
          {message && <p className="text-light mb-3">{message}</p>}
          <div className="d-flex justify-content-center gap-2">
            <button className="btn btn-primary" onClick={handleCheckAgain} disabled={checking}>
              {checking ? 'Checking...' : 'Check Again'}
            </button>
            <button className="btn btn-outline-light" onClick={() => navigate('/logout')}>
              Go to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionExpired;
