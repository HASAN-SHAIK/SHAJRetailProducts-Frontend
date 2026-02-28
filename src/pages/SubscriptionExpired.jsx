import React from 'react';
import { useNavigate } from 'react-router-dom';

const SubscriptionExpired = () => {
  const navigate = useNavigate();

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
          <button className="btn btn-primary" onClick={() => navigate('/logout')}>
            Go to Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionExpired;
