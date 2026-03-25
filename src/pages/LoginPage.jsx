import { useState } from 'react';
import api from '../utils/axios';
import { useNavigate } from 'react-router-dom';
import Login from '../components/Login/Login';
import { preloadProductsToIndexedDb } from '../utils/indexedDb';
import { saveAuthToken, saveSessionInfo } from '../utils/sessionStorage';

const LoginPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const res = await api.post('/auth/login', form); // cookie is auto-stored
      if (res.data?.token && typeof window !== 'undefined') {
        try {
          await saveAuthToken(res.data.token);
          await saveSessionInfo({ token: res.data.token, user: res.data.user || null });
        } catch (err) {
          // Ignore storage failures (private mode / blocked storage)
        }
      }
      try {
        await preloadProductsToIndexedDb();
      } catch (err) {
        console.error('IndexedDB preload failed', err);
      }
      navigate('/dashboard'); // redirect on success
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="wow-page login-page">
      <div className="wow-motion-layer" aria-hidden="true">
        <span className="wow-orb orb-a"></span>
        <span className="wow-orb orb-b"></span>
        <span className="wow-orb orb-c"></span>
        <span className="wow-orb orb-d"></span>
        <span className="wow-ring ring-a"></span>
        <span className="wow-ring ring-b"></span>
        <span className="wow-pulse"></span>
      </div>
      <div className="wow-content">
        <Login/>
      </div>
    </div>
    // <div className="container mt-5">
    //   <h2>Login</h2>
    //   {error && <div className="alert alert-danger">{error}</div>}
    //   <form onSubmit={handleSubmit}>
    //     <div className="mb-3">
    //       <label>Email</label>
    //       <input type="email" name="email" className="form-control" value={form.email} onChange={handleChange} required />
    //     </div>
    //     <div className="mb-3">
    //       <label>Password</label>
    //       <input type="password" name="password" className="form-control" value={form.password} onChange={handleChange} required />
    //     </div>
    //     <button className="btn btn-primary">Login</button>
    //   </form>
    // </div>
  );
};

export default LoginPage;
