// src/pages/Login/Login.js

import React, { useMemo, useState } from 'react';
import './Login.css';
import api from '../../utils/axios';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setUserDetails } from '../../store/userSlice';
import logo from '../../Images/logo.png';
import { getDeviceId } from '../../utils/device';
import { decodeJwtPayload } from '../../utils/jwt';
import { setTenantIdentity } from '../../store/tenantSlice';
import { getAuthToken, getSessionInfo, saveAuthToken, saveSessionInfo } from '../../utils/sessionStorage';

const Login = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [offlineSessionUser, setOfflineSessionUser] = useState(null);
  const resumeEmail = process.env.REACT_APP_RESUME_EMAIL || 'admin@hasan.com';
  const resumePassword = process.env.REACT_APP_RESUME_PASSWORD || 'admin';
  const showResumeAccess = String(process.env.REACT_APP_FOR_RESUME || '').toLowerCase() === 'true';
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const capabilities = useMemo(
    () => [
      {
        eyebrow: 'Billing',
        title: 'Fast order processing',
        text: 'Run retail billing with synced inventory and customer-aware reorder history.',
      },
      {
        eyebrow: 'Accounts',
        title: 'Reliable cash and ledger control',
        text: 'Track receipts, payments, and outstanding balances without losing branch visibility.',
      },
      {
        eyebrow: 'Inventory',
        title: 'Precise stock movement',
        text: 'Manage purchases, batches, and returns with device-safe branch operations.',
      },
    ],
    []
  );

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleUseResumeAccess = () => {
    setForm({ email: resumeEmail, password: resumePassword });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const deviceId = getDeviceId();
      const res = await api.post('/auth/login', { device_id: deviceId, ...form });
      let decoded = null;

      if (res.data?.token && typeof window !== 'undefined') {
        try {
          await saveAuthToken(res.data.token);
          decoded = decodeJwtPayload(res.data.token);
        } catch (storageErr) {
          // Ignore storage failures
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
        email: form.email,
      } : null);

      try {
        await saveSessionInfo({
          token: res.data?.token || null,
          user: userPayload,
          tenant: res.data?.tenant || null,
        });
      } catch (storageErr) {
        // Ignore storage failures
      }

      dispatch(setUserDetails(userPayload));
      try {
        localStorage.removeItem('selected_branch_id');
      } catch (storageErr) {
        // Ignore storage failures
      }
      setIsLoading(false);
      navigate('/setup');
    } catch (err) {
      setIsLoading(false);
      console.error('Login error:', err);
      const status = err?.response?.status;
      const code = err?.response?.data?.code;
      const message = err?.response?.data?.message || err?.message || 'Login failed';
      const networkDown = status === 0 || err?.isNetworkError;

      if (networkDown) {
        const session = await getSessionInfo().catch(() => null);
        const cachedUser = session?.user || null;
        if (cachedUser) {
          setOfflineSessionUser(cachedUser);
          setError('Server is offline. You can continue in offline mode using the last signed-in account on this device.');
          return;
        }
        setError('Server is offline and no previous local session is available on this device.');
        return;
      }

      if (status === 404 || code === 'TENANT_NOT_FOUND') {
        setError('Tenant not found for this email domain. Please verify the email or contact admin.');
        return;
      }

      if (status === 403 && code === 'DEVICE_LIMIT_REACHED') {
        setError('This branch has reached its device limit. Please remove an existing device or upgrade the plan.');
        return;
      }

      if (status === 403 && code === 'DEVICE_NOT_ALLOWED') {
        setError('This device is not allowed for the selected branch. Please contact admin for access.');
        return;
      }

      setError(message);
    }
  };

  const handleContinueOffline = async () => {
    if (!offlineSessionUser) return;
    const enteredEmail = String(form.email || '').trim().toLowerCase();
    const cachedEmail = String(offlineSessionUser?.email || '').trim().toLowerCase();
    if (cachedEmail && enteredEmail && enteredEmail !== cachedEmail) {
      setError(`Offline mode is only available for the last signed-in account (${cachedEmail}).`);
      return;
    }

    dispatch(setUserDetails(offlineSessionUser));
    let tenantId = offlineSessionUser?.tenant_id || null;
    let role = offlineSessionUser?.role || null;
    let userId = offlineSessionUser?.id || null;
    if (!tenantId || !role || !userId) {
      const token = await getAuthToken().catch(() => null);
      const decoded = decodeJwtPayload(token);
      tenantId = tenantId || decoded?.tenant_id || null;
      role = role || decoded?.role || null;
      userId = userId || decoded?.user_id || null;
    }
    if (tenantId || role || userId) {
      dispatch(setTenantIdentity({ tenantId, role, userId }));
    }
    navigate('/setup');
  };

  return (
    <div className="login-shell">
      <div className="login-orb login-orb-teal"></div>
      <div className="login-orb login-orb-blue"></div>
      <div className="login-orb login-orb-soft"></div>

      <main className="login-layout">
        <section className="login-hero">
          <div className="login-hero-badge">SHAJTech Enterprise Suite</div>
          <div className="login-hero-copy">
            <h1>Controlled power for billing, inventory, and accounts.</h1>
            <p>
              Built for teams that need enterprise-grade clarity without slowing down daily operations.
            </p>
          </div>

          <div className="login-hero-grid">
            {capabilities.map((item) => (
              <article key={item.title} className="login-feature-card">
                <span className="login-feature-eyebrow">{item.eyebrow}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="login-panel">
          <div className="login-panel-topline">Secure login</div>

          <div className="login-brand-lockup">
            <div className="login-logo-wrap">
              <img className="companyLogo" src={logo} alt="SHAJ Logo" />
            </div>
            <div className="login-brand-copy">
              <h2>Welcome back</h2>
              <p>Sign in with your user credentials to connect to your tenant workspace.</p>
            </div>
          </div>

          {showResumeAccess && (
            <div className="resume-card">
              <div>
                <span className="resume-label">Resume Access</span>
                <div className="resume-value">{resumeEmail}</div>
                <div className="resume-value">{resumePassword}</div>
              </div>
              <button type="button" className="resume-fill-btn" onClick={handleUseResumeAccess}>
                Use these
              </button>
            </div>
          )}

          {error && <div className="login-inline-error">{error}</div>}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="field-group">
              <label className="field-label" htmlFor="login-email">Email</label>
              <input
                id="login-email"
                className="field-input"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="you@yourshop.com"
                autoComplete="username"
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="login-password">Password</label>
              <div className="password-field">
                <input
                  id="login-password"
                  className="field-input password-input"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange}
                  required
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button type="submit" className="login-primary-btn" disabled={isLoading}>
              {isLoading ? (
                <span className="login-btn-loading">
                  <span className="spinner-border spinner-style text-light" role="status"></span>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>

            {offlineSessionUser && (
              <button
                type="button"
                className="login-secondary-btn"
                onClick={handleContinueOffline}
              >
                Continue Offline
              </button>
            )}
          </form>

          <div className="login-footnote">
            Uses the existing backend auth flow with device registration and tenant-based domain routing.
          </div>
        </section>
      </main>
    </div>
  );
};

export default Login;
