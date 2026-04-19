import React from 'react';
import { NavLink } from 'react-router-dom';

const AccountsSidebar = ({ collapsed, onToggle }) => {
  return (
    <aside className={`context-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="context-sidebar__header">
        <div className="context-sidebar__title">Accounts</div>
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
        <NavLink className="context-sidebar__link" to="/accounts/receipt">
          <span className="context-sidebar__link-text">Receipt Entry</span>
        </NavLink>
        <NavLink className="context-sidebar__link" to="/accounts/payment">
          <span className="context-sidebar__link-text">Payment Entry</span>
        </NavLink>
        <NavLink className="context-sidebar__link" to="/accounts/cashbook">
          <span className="context-sidebar__link-text">Cash Book</span>
        </NavLink>
        <NavLink className="context-sidebar__link" to="/accounts/bankbook">
          <span className="context-sidebar__link-text">Bank Book</span>
        </NavLink>
        <NavLink className="context-sidebar__link" to="/accounts/ledger">
          <span className="context-sidebar__link-text">Ledger</span>
        </NavLink>
        <NavLink className="context-sidebar__link" to="/accounts/outstanding">
          <span className="context-sidebar__link-text">Outstanding</span>
        </NavLink>
      </nav>
    </aside>
  );
};

export default AccountsSidebar;
