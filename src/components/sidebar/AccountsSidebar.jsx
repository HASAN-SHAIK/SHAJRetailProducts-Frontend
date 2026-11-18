import React from 'react';
import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  canAccessReceiptEntry,
  canAccessPaymentEntry,
  canAccessExpenseEntry,
  canAccessCashBook,
  canAccessOutstanding,
  getStoredSessionUser,
} from '../../utils/permissions';
import MobileModuleNav from './MobileModuleNav';

const AccountsSidebar = ({ collapsed, onToggle, isDrawerOpen, onCloseDrawer, onItemClick }) => {
  const storeUser = useSelector((state) => state?.user?.userDetails);
  const user = storeUser || getStoredSessionUser();

  const showReceipt = canAccessReceiptEntry(user);
  const showPayment = canAccessPaymentEntry(user);
  const showExpense = canAccessExpenseEntry(user);
  const showCashBook = canAccessCashBook(user);
  const showOutstanding = canAccessOutstanding(user);

  return (
    <aside className={`context-sidebar ${collapsed ? 'collapsed' : ''} ${isDrawerOpen ? 'drawer-open' : ''}`}>
      <div className="context-sidebar__header">
        <div className="context-sidebar__title">Accounts</div>
        <button
          type="button"
          className="context-sidebar__close-btn"
          onClick={onCloseDrawer || onToggle}
          aria-label="Close sidebar drawer"
        >
          &times;
        </button>
        <button
          type="button"
          className={`context-sidebar__toggle${collapsed ? '' : ' is-open'}`}
          onClick={onToggle}
          aria-label="Toggle sidebar"
          aria-expanded={!collapsed}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
      <nav className="context-sidebar__nav">
        {showReceipt && (
          <NavLink className="context-sidebar__link" to="/accounts/receipt" onClick={onItemClick}>
            <span className="context-sidebar__link-text">Receipt Entry</span>
          </NavLink>
        )}
        {showPayment && (
          <NavLink className="context-sidebar__link" to="/accounts/payment" onClick={onItemClick}>
            <span className="context-sidebar__link-text">Payment Entry</span>
          </NavLink>
        )}
        {showExpense && (
          <NavLink className="context-sidebar__link" to="/accounts/expense" onClick={onItemClick}>
            <span className="context-sidebar__link-text">Expense Entry</span>
          </NavLink>
        )}
        {showCashBook && (
          <NavLink className="context-sidebar__link" to="/accounts/cashbook" onClick={onItemClick}>
            <span className="context-sidebar__link-text">Cash Book</span>
          </NavLink>
        )}
        <NavLink className="context-sidebar__link" to="/accounts/bankbook" onClick={onItemClick}>
          <span className="context-sidebar__link-text">Bank Book</span>
        </NavLink>
        <NavLink className="context-sidebar__link" to="/accounts/ledger" onClick={onItemClick}>
          <span className="context-sidebar__link-text">Ledger</span>
        </NavLink>
        {showOutstanding && (
          <NavLink className="context-sidebar__link" to="/accounts/outstanding" onClick={onItemClick}>
            <span className="context-sidebar__link-text">Outstanding</span>
          </NavLink>
        )}
      </nav>
      <MobileModuleNav onItemClick={onItemClick} />
    </aside>
  );
};

export default AccountsSidebar;
