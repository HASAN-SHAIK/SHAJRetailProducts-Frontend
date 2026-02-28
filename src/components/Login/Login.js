// src/pages/Login/Login.js

import React, { useState } from 'react';
import './Login.css';
import api from '../../utils/axios';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setUserDetails } from '../../store/userSlice'; // Assuming you have a Redux slice for user details
import logo from '../../Images/logo.png';
import { getDeviceId } from '../../utils/device';
import { decodeJwtPayload } from '../../utils/jwt';
import { setTenantConfig, setTenantConfigStatus, setTenantIdentity, setSubscriptionStatus } from '../../store/tenantSlice';
const Login = ( ) => {
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    setIsLoading(true);
    e.preventDefault();
    setError('');

    try {
      const deviceId = getDeviceId();
      const res = await api.post('/auth/login', {device_id: deviceId, ...form}); // Set-Cookie works if backend handles it
      let decoded = null;
      if (res.data?.token && typeof window !== 'undefined') {
        try {
          localStorage.setItem('auth_token', res.data.token);
          decoded = decodeJwtPayload(res.data.token);
        } catch (err) {
          // Ignore storage failures (private mode / blocked storage)
        }
      }
      if (decoded) {
        dispatch(setTenantIdentity({
          tenantId: decoded.tenant_id,
          role: decoded.role,
          userId: decoded.user_id,
        }));
      }
      const userPayload = res.data.user || (decoded ? {
        id: decoded.user_id,
        role: decoded.role,
        tenant_id: decoded.tenant_id,
      } : null);
      dispatch(setUserDetails(userPayload)); // Dispatch user details to Redux store

      dispatch(setTenantConfigStatus('loading'));
      try {
        const configRes = await api.get('/platform/config');
        const payload = configRes?.data?.data || configRes?.data || {};
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
          setIsLoading(false);
          navigate('/subscription-expired');
          return;
        }
        dispatch(setTenantConfigStatus('error'));
        console.error('Failed to fetch tenant config', err);
      }
      setIsLoading(false);
      navigate('/dashboard');
    } catch (err) {
      setIsLoading(false);
      console.error('Login error:', err);
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="login-wrapper">
       <img className='companyLogo' src={logo} alt="SHAJ Logo" width="30%" height="20%"/>
      <div className="login-container">
        <h2 className="tenant-name">SHAJ NextGen Technologies</h2>
        {/* <p className='disabled'>Use password 'admin'</p> */}
      <div className="floating-shape logincube green"></div>
      <div className="floating-shape logincircle red"></div>
        {error && <div className="alert text-danger text-center loginErrorMessage">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label className='form-label'>Email</label>
          <input
            className='form-control loginzindex'
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
            placeholder="admin@example.com"
          />

          <label className='form-label'>Password</label>
          <input
            className='form-control loginpasswordinput'
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            required
            placeholder="••••••"
            style={{zIndex: '1000 !important'}}
          />
         <div className="floating-shape loginring orange"></div>
          <button style={{zIndex: 1000}} type="submit" className='letsgo'>{ isLoading ? <div class="spinner-border spinner-style text-light" role="status"></div> : `Let's Go`}</button>
        </form>
      </div>

      {/* Floating decorative shapes */}
      <div className="floating-shape circle red"></div>
      <div className="floating-shape triangle purple"></div>
      <div className="floating-shape square yellow"></div>
      <div className="floating-shape wave pink"></div>
      <div className="floating-shape ring orange"></div>
      <div className="floating-shape cube green"></div>
    </div>
  );
};

export default Login;
