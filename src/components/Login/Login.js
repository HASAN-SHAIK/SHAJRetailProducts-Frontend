// src/pages/Login/Login.js

import React, { useState } from 'react';
import './Login.css';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setUserDetails } from '../../store/userSlice';
import logo from '../../Images/logo.png';
import { getDeviceId } from '../../utils/device';
import { decodeJwtPayload } from '../../utils/jwt';
import { setTenantIdentity } from '../../store/tenantSlice';
import { getSessionInfo } from '../../utils/sessionStorage';
import { login as sqlLogin, issueOfflinePosGrant } from '../../services/authService';
import {
  enrollLocalPosUser,
  getCachedLocalPosUserId,
  isLocalPosEnabled,
  loginLocalPosUser,
} from '../../Repositories/local/posLocalApiClient';

const validPin = (value) => /^\d{4,8}$/.test(String(value || ''));

const Login = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', posPin: '' });
  const [error, setError] = useState('');
  const [offlineSessionUser, setOfflineSessionUser] = useState(null);
  const posEnabled = isLocalPosEnabled();
  const resumeEmail = process.env.REACT_APP_RESUME_EMAIL || 'admin@hasan.com';
  const resumePassword = process.env.REACT_APP_RESUME_PASSWORD || 'admin';
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const applyUser = (userPayload, decoded = null) => {
    if (decoded) {
      dispatch(setTenantIdentity({ tenantId: decoded.tenant_id, role: decoded.role, userId: decoded.user_id }));
    } else if (userPayload) {
      dispatch(setTenantIdentity({ tenantId: userPayload.tenant_id, role: userPayload.role, userId: userPayload.id }));
    }
    dispatch(setUserDetails(userPayload));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (posEnabled && !validPin(form.posPin)) {
      setError('Enter a 4–8 digit POS PIN. This PIN is used only for verified offline cashier login on this device.');
      return;
    }
    setIsLoading(true);

    try {
      const deviceId = getDeviceId();
      const data = await sqlLogin({ device_id: deviceId, remember_me: true, email: form.email, password: form.password });

      let decoded = null;
      if (data?.token && typeof window !== 'undefined') {
        try { decoded = decodeJwtPayload(data.token); } catch { decoded = null; }
      }
      const userPayload = data.user || (decoded ? { id: decoded.user_id, role: decoded.role, tenant_id: decoded.tenant_id } : null);
      if (!userPayload?.id) throw new Error('authenticated_user_missing');

      if (posEnabled) {
        const grantPayload = await issueOfflinePosGrant({ deviceId });
        if (!grantPayload?.offline_grant) throw new Error('offline_pos_grant_missing');
        await enrollLocalPosUser({ offlineGrant: grantPayload.offline_grant, pin: form.posPin });
        await loginLocalPosUser({ userId: userPayload.id, pin: form.posPin });
      }

      applyUser(userPayload, decoded);
      navigate('/setup');
    } catch (err) {
      console.error('Login error:', err);
      const status = err?.response?.status;
      const networkDown = status === 0 || err?.isNetworkError || err?.code === 'ERR_NETWORK';
      if (networkDown && posEnabled) {
        const session = await getSessionInfo().catch(() => null);
        const cachedUser = session?.user || null;
        const cachedLocalUserId = getCachedLocalPosUserId();
        if (cachedUser && cachedLocalUserId) {
          setOfflineSessionUser(cachedUser);
          setError('Central server is offline. Enter your POS PIN and choose Continue Offline.');
        } else {
          setError('Central server is offline and this device has no enrolled offline cashier. Connect once and sign in online to enroll a POS PIN.');
        }
      } else {
        setError(err?.response?.data?.message || err?.payload?.error || err?.message || 'Login failed');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinueOffline = async () => {
    setError('');
    if (!offlineSessionUser) return;
    if (!validPin(form.posPin)) { setError('Enter your 4–8 digit POS PIN.'); return; }
    const cachedUserId = getCachedLocalPosUserId();
    if (!cachedUserId) { setError('No offline cashier is enrolled on this device.'); return; }
    try {
      const local = await loginLocalPosUser({ userId: cachedUserId, pin: form.posPin });
      const localUser = local?.user || {};
      const userPayload = {
        ...offlineSessionUser,
        id: localUser.user_id || offlineSessionUser.id,
        tenant_id: localUser.tenant_id || offlineSessionUser.tenant_id,
        role: localUser.role || offlineSessionUser.role,
        branch_id: localUser.branch_id || offlineSessionUser.branch_id,
        permissions: localUser.permissions || offlineSessionUser.permissions || [],
        email: offlineSessionUser?.email || '',
        offline: true,
      };
      applyUser(userPayload);
      navigate('/setup');
    } catch (err) {
      if (err?.status === 429 || err?.payload?.error === 'local_auth_temporarily_locked') {
        setError('Too many incorrect POS PIN attempts. Offline login is temporarily locked; try again in a few minutes.');
      } else if (err?.payload?.error === 'offline_grant_expired') {
        setError('Offline authorization has expired. Connect to the central server and sign in again.');
      } else {
        setError('Invalid POS PIN or offline authorization is no longer valid.');
      }
    }
  };

  return (
    <div className="login-wrapper">
      <img className='companyLogo' src={logo} alt="SHAJ Logo" width="30%" height="20%"/>
      <div className="login-container">
        <h2 className="tenant-name">SHAJ NextGen Technologies</h2>
        {process.env.REACT_APP_FOR_RESUME && <p className='demoCredentials'>Demo credentials: {resumeEmail} / {resumePassword}</p>}
        <div className="floating-shape logincube green"></div>
        <div className="floating-shape logincircle red"></div>
        {error && <div className="alert text-danger text-center loginErrorMessage">{error}</div>}
        <form onSubmit={handleSubmit}>
          <label className='form-label'>Email</label>
          <input className='form-control loginzindex' type="email" name="email" value={form.email} onChange={handleChange} required placeholder="admin@example.com" />
          <label className='form-label'>Password</label>
          <input className='form-control loginpasswordinput' name="password" type="password" value={form.password} onChange={handleChange} required placeholder="••••••" />
          {posEnabled && <>
            <label className='form-label'>POS PIN</label>
            <input className='form-control loginpasswordinput' name="posPin" type="password" inputMode="numeric" pattern="[0-9]{4,8}" autoComplete="off" value={form.posPin} onChange={handleChange} placeholder="4–8 digits" required />
            <small className="form-text text-muted">Used for cashier login when this POS is offline. Your central password is never stored locally.</small>
          </>}
          <div className="floating-shape loginring orange"></div>
          <button style={{zIndex: 1000}} type="submit" className='letsgo'>
            {isLoading ? <div className="spinner-border spinner-style text-light" role="status"></div> : `Let's Go`}
          </button>
          {offlineSessionUser && posEnabled && <button style={{ zIndex: 1000, marginTop: 10 }} type="button" className='letsgo' onClick={handleContinueOffline}>Continue Offline</button>}
        </form>
      </div>
      <div className="floating-shape circle red"></div><div className="floating-shape triangle purple"></div><div className="floating-shape square yellow"></div><div className="floating-shape wave pink"></div><div className="floating-shape ring orange"></div><div className="floating-shape cube green"></div>
    </div>
  );
};

export default Login;
