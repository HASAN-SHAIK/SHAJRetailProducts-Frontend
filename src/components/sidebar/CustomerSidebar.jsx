import React from 'react';
import { NavLink } from 'react-router-dom';

const CustomerSidebar = ({ collapsed, onToggle }) => {
  return (
    <aside className={`context-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="context-sidebar__header">
        <div className="context-sidebar__title">Customers</div>
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
        <NavLink className="context-sidebar__link" to="/customers" end>
          <span className="context-sidebar__link-text">Customers List</span>
        </NavLink>
        <NavLink className="context-sidebar__link" to="/customers/reorder">
          <span className="context-sidebar__link-text">Customer Reorder</span>
        </NavLink>
      </nav>
    </aside>
  );
};

export default CustomerSidebar;
