import React from 'react';
import { NavLink } from 'react-router-dom';

const OrdersSidebar = ({ collapsed, onToggle }) => {
  return (
    <aside className={`context-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="context-sidebar__header">
        <div className="context-sidebar__title">Orders</div>
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
        <NavLink className="context-sidebar__link" to="/orders/sales">
          <span className="context-sidebar__link-text">Sales Orders</span>
        </NavLink>
        <NavLink className="context-sidebar__link" to="/orders/purchases">
          <span className="context-sidebar__link-text">Purchase Orders</span>
        </NavLink>
      </nav>
    </aside>
  );
};

export default OrdersSidebar;
