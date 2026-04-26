import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js'; // For Bootstrap's JavaScript features
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import {persistor,store} from './store/store'; 
import { PersistGate } from 'redux-persist/integration/react';
import { PopupProvider } from './components/common/PopUp/PopupProvider';

const cleanupLegacyServiceWorkers = async () => {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch {
    // Best-effort cleanup only; app startup must continue.
  }

  if (!('caches' in window)) return;
  try {
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
  } catch {
    // Ignore cache deletion failures.
  }
};

cleanupLegacyServiceWorkers();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter>  
  <React.StrictMode>
  <Provider store={store}>
    <PersistGate loading={null} persistor={persistor}>
      <PopupProvider>
        <App />
      </PopupProvider>
    </PersistGate>
  </Provider>
  </React.StrictMode>
  </BrowserRouter>

);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
