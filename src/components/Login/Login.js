// src/pages/Login/Login.js

import React, { useEffect, useState } from 'react';
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
  getLocalPosDevice,
  isLocalPosEnabled,
  loginLocalPosUser,
  registerLocalPosDevice,
} from '../../Repositories/local/posLocalApiClient';
import {
  claimPosRegistration,
  getPosRegistrationStatus,
  loadPendingPosRegistration,
  requestPosRegistration,
} from '../../services/posRegistrationService';

const validPin = (value) => /^\d{4,8}$/.test(String(value || ''));

const Login = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', posPin: '' });
  const [error, setError] = useState('');
  const [offlineSessionUser, setOfflineSessionUser] = useState(null);
  const [registrationDevice, setRegistrationDevice] = useState(null);
  const [registrationTenantId, setRegistrationTenantId] = useState(process.env.REACT_APP_POS_TENANT_ID || '');
  const [registration, setRegistration] = useState(() => loadPendingPosRegistration());
  const [registrationBusy, setRegistrationBusy] = useState(false);
  const posEnabled = isLocalPosEnabled();
  const resumeEmail = process.env.REACT_APP_RESUME_EMAIL || 'admin@hasan.com';
  const resumePassword = process.env.REACT_APP_RESUME_PASSWORD || 'admin';
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  useEffect(() => {
    if (!posEnabled) return;
    getLocalPosDevice().then((device) => {
      setRegistrationDevice(device || null);
      if (device?.store_id) return;
      const pending = loadPendingPosRegistration();
      if (pending) {
        setRegistration(pending);
        if (pending.tenant_id) setRegistrationTenantId(String(pending.tenant_id));
      }
    }).catch(() => {});
  }, [posEnabled]);

  useEffect(() => {
    if (!registration?.request_id || !registration?.request_token) return undefined;
    let cancelled = false;
    const check = async () => {
      try {
        const next = await getPosRegistrationStatus(registration);
        if (!cancelled && next) setRegistration(next);
      } catch (err) {
        if (!cancelled && err?.status !== 404) console.warn('POS registration status check failed', err);
      }
    };
    check();
    const id = setInterval(check, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [registration?.request_id, registration?.request_token]);

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
        const localDevice = await getLocalPosDevice();
        setRegistrationDevice(localDevice || null);
        const posDeviceId = String(localDevice?.device_id || '').trim();
        if (!posDeviceId) throw new Error('local_pos_device_missing');
        if (!localDevice?.store_id) {
          const tenantId = String(userPayload?.tenant_id || decoded?.tenant_id || registrationTenantId || '').trim();
          if (tenantId) setRegistrationTenantId(tenantId);
          setError('This POS is not registered yet. Send a registration request below, then ask your Retail Hub administrator to approve it and assign a store.');
          return;
        }
        const grantPayload = await issueOfflinePosGrant({ deviceId: posDeviceId });
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

  const handleRequestRegistration = async () => {
    setError('');
    const tenantId = String(registrationTenantId || '').trim();
    if (!tenantId) { setError('Tenant ID is required to send this POS registration request.'); return; }
    setRegistrationBusy(true);
    try {
      const device = registrationDevice || await getLocalPosDevice();
      if (!device?.device_id) throw new Error('local_pos_device_missing');
      if (device?.store_id) { setError('This POS is already registered to a store.'); return; }
      const pending = await requestPosRegistration({ tenantId, device });
      setRegistrationDevice(device);
      setRegistration(pending);
      setError('Registration request sent. Open Retail Hub → POS & Devices and approve this terminal. This screen will check automatically.');
    } catch (err) {
      if (err?.payload?.code === 'REGISTRATION_REQUEST_EXISTS') {
        setError('A pending request already exists for this POS. If this browser lost its request token, reject the old request in Retail Hub and send a new one.');
      } else {
        setError(err?.payload?.message || err?.message || 'Unable to send POS registration request.');
      }
    } finally { setRegistrationBusy(false); }
  };

  const handleActivateApprovedRegistration = async () => {
    setRegistrationBusy(true);setError('');
    try {
      const current = await getPosRegistrationStatus(registration);
      if (current?.status !== 'APPROVED' || !current?.branch_id || !current?.terminal_id) {
        setRegistration(current || registration);
        setError(current?.status === 'REJECTED' ? 'This POS registration request was rejected.' : 'Still waiting for Retail Hub approval.');
        return;
      }
      await registerLocalPosDevice({ storeId: current.branch_id, terminalId: current.terminal_id });
      await claimPosRegistration(current);
      const localDevice = await getLocalPosDevice();
      setRegistrationDevice(localDevice);
      setRegistration(null);
      setError(`POS activated for store ${current.branch_id} as terminal ${current.terminal_id}. Sign in again to enroll your POS PIN.`);
    } catch (err) {
      setError(err?.payload?.message || err?.payload?.error || err?.message || 'Unable to activate approved POS registration.');
    } finally { setRegistrationBusy(false); }
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

  const unregistered = posEnabled && registrationDevice && !registrationDevice?.store_id;
  const registrationStatus = String(registration?.status || '').toUpperCase();

  return (
    <div className="login-wrapper">
      <img className='companyLogo' src={logo} alt="SHAJ Logo" width="30%" height="20%"/>
      <div className="login-container">
        <h2 className="tenant-name">SHAJ NextGen Technologies</h2>
        {process.env.REACT_APP_FOR_RESUME && <p className='demoCredentials'>Demo credentials: {resumeEmail} / {resumePassword}</p>}
        <div className="floating-shape logincube green"></div>
        <div className="floating-shape logincircle red"></div>
        {error && <div className="alert text-danger text-center loginErrorMessage">{error}</div>}

        {unregistered && <div className="mb-3 p-3 rounded border" style={{position:'relative',zIndex:1000}}>
          <strong>Activate this POS</strong>
          <div className="small text-muted mb-2">Device: {registrationDevice?.device_id}</div>
          <label className="form-label">Tenant ID</label>
          <input className="form-control loginzindex" value={registrationTenantId} onChange={e=>setRegistrationTenantId(e.target.value)} placeholder="e.g. 11" disabled={Boolean(registration?.request_id)}/>
          {!registration?.request_id && <button type="button" className="letsgo" style={{marginTop:12,zIndex:1000}} disabled={registrationBusy} onClick={handleRequestRegistration}>{registrationBusy?'Sending...':'Register this POS'}</button>}
          {registration?.request_id && <div className="mt-2">
            <div className="small">Request: <span className="mono">{registration.request_id}</span></div>
            <div className="small">Status: <strong>{registrationStatus||'PENDING'}</strong></div>
            <button type="button" className="letsgo" style={{marginTop:10,zIndex:1000}} disabled={registrationBusy} onClick={handleActivateApprovedRegistration}>{registrationStatus==='APPROVED'?'Activate approved POS':'Check approval'}</button>
          </div>}
        </div>}

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
