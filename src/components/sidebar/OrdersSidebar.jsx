import React from 'react';
import { NavLink } from 'react-router-dom';
import MobileModuleNav from './MobileModuleNav';

const OrdersSidebar = ({ collapsed, onToggle, isDrawerOpen, onCloseDrawer, onItemClick }) => {
  return (
    <aside className={`context-sidebar ${collapsed ? 'collapsed' : ''} ${isDrawerOpen ? 'drawer-open' : ''}`}>
      <div className="context-sidebar__header">
        <div className="context-sidebar__title">Orders</div>
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
        <NavLink className="context-sidebar__link" to="/orders/sales" onClick={onItemClick}>
          <span className="context-sidebar__link-text">Sales Orders</span>
        </NavLink>
        <NavLink className="context-sidebar__link" to="/orders/purchases" onClick={onItemClick}>
          <span className="context-sidebar__link-text">Purchase Orders</span>
        </NavLink>
      </nav>
      <MobileModuleNav onItemClick={onItemClick} />
    </aside>
  );
};

export default OrdersSidebar;
