import React from 'react';
import { useLocation } from 'react-router-dom';
import BillingSidebar from '../sidebar/BillingSidebar';
import InventorySidebar from '../sidebar/InventorySidebar';
import CustomerSidebar from '../sidebar/CustomerSidebar';
import AccountsSidebar from '../sidebar/AccountsSidebar';
import StaffExpensesSidebar from '../sidebar/StaffExpensesSidebar';
import ReturnsCorrectionsSidebar from '../sidebar/ReturnsCorrectionsSidebar';
import './ContextSidebar.css';

const ContextSidebar = ({ collapsed, onToggle }) => {
  const location = useLocation();
  const module = String(location.pathname || '').split('/')[1] || '';

  const sidebarProps = { collapsed, onToggle };

  if (module === 'billing') return <BillingSidebar {...sidebarProps} />;
  if (module === 'inventory') return <InventorySidebar {...sidebarProps} />;
  if (module === 'customers') return <CustomerSidebar {...sidebarProps} />;
  if (module === 'accounts') return <AccountsSidebar {...sidebarProps} />;
  if (module === 'staff-expenses') return <StaffExpensesSidebar {...sidebarProps} />;
  if (module === 'returns-corrections') return <ReturnsCorrectionsSidebar {...sidebarProps} />;
  return null;
};

export default ContextSidebar;
