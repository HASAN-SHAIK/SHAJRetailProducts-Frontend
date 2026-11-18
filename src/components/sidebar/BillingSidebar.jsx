import React from 'react';
import { NavLink } from 'react-router-dom';
import MobileModuleNav from './MobileModuleNav';

const BillingSidebar = ({ collapsed, onToggle, isDrawerOpen, onCloseDrawer, onItemClick }) => {
  return (
    <aside className={`context-sidebar ${collapsed ? 'collapsed' : ''} ${isDrawerOpen ? 'drawer-open' : ''}`}>
      <div className="context-sidebar__header">
        <div className="context-sidebar__title">Billing</div>
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
        <NavLink className="context-sidebar__link" to="/billing/retail" onClick={onItemClick}>
          <span className="context-sidebar__link-text">Retail Billing</span>
        </NavLink>
        <NavLink className="context-sidebar__link" to="/billing/wholesale" onClick={onItemClick}>
          <span className="context-sidebar__link-text">Wholesale Billing</span>
        </NavLink>
      </nav>
      <MobileModuleNav onItemClick={onItemClick} />
    </aside>
  );
};

export default BillingSidebar;
