import React from 'react';
import { NavLink } from 'react-router-dom';

const BillingSidebar = ({ collapsed, onToggle }) => {
  return (
    <aside className={`context-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="context-sidebar__header">
        <div className="context-sidebar__title">Billing</div>
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
        <NavLink className="context-sidebar__link" to="/billing/retail">
          <span className="context-sidebar__link-text">Retail Billing</span>
        </NavLink>
        <NavLink className="context-sidebar__link" to="/billing/wholesale">
          <span className="context-sidebar__link-text">Wholesale Billing</span>
        </NavLink>
      </nav>
    </aside>
  );
};

export default BillingSidebar;
