import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import ContextSidebar from './ContextSidebar';
import './ContextSidebar.css';

const ContextLayout = () => {
  const location = useLocation();
  const isMobileRoute = location.pathname.startsWith('/m');
  const module = String(location.pathname || '').split('/')[1] || '';
  const modulesWithSidebar = new Set([
    'billing',
    'inventory',
    'customers',
    'accounts',
    'orders',
    'staff-expenses',
    'returns-corrections',
  ]);
  const hasSidebar = modulesWithSidebar.has(module);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('context_sidebar_collapsed');
      if (stored === '1') {
        setCollapsed(true);
        return;
      }
      if (stored === '0') {
        setCollapsed(false);
        return;
      }
    } catch {
      // ignore
    }

    if (typeof window !== 'undefined' && window.matchMedia) {
      const media = window.matchMedia('(max-width: 1024px)');
      if (media.matches) {
        setCollapsed(true);
      }
    }
  }, []);

  const handleToggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('context_sidebar_collapsed', next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  };
  if (isMobileRoute) {
    return <Outlet />;
  }

  return (
    <div className={`context-layout ${collapsed ? 'is-collapsed' : ''}`}>
      <ContextSidebar collapsed={collapsed} onToggle={handleToggle} />
      <div className={`context-content ${hasSidebar ? '' : 'no-sidebar'}`.trim()}>
        <Outlet />
      </div>
    </div>
  );
};

export default ContextLayout;
