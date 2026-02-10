// src/pages/Login/Login.js

import React, { useState } from 'react';
import './Login.css';
import api from '../../utils/axios';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setUserDetails } from '../../store/userSlice'; // Assuming you have a Redux slice for user details
import { useSelector } from 'react-redux';
import logo from '../../Images/logo.png';
import { getDeviceId } from '../../utils/device';
const Login = ( ) => {
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const userDetails = useSelector((state) => state.user.userDetails);
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
      dispatch(setUserDetails(res.data.user)); // Dispatch user details to Redux store
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
        <h2>Ameena Automobiles</h2>
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