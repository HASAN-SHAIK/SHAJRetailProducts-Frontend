import React from 'react';
import { NavLink } from 'react-router-dom';


const InventorySidebar = ({ collapsed, onToggle }) => {
  return (
    <aside className={`context-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="context-sidebar__header">
        <div className="context-sidebar__title">Inventory</div>
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
        <NavLink className="context-sidebar__link" to="/inventory/catalog">
          <span className="context-sidebar__link-text">Product Catalog</span>
        </NavLink>
        <NavLink className="context-sidebar__link" to="/inventory/purchase">
          <span className="context-sidebar__link-text">Purchase</span>
        </NavLink>
        <NavLink className="context-sidebar__link" to="/inventory/purchases">
          <span className="context-sidebar__link-text">Purchase Book</span>
        </NavLink>
        <NavLink className="context-sidebar__link" to="/inventory/purchase-returns">
          <span className="context-sidebar__link-text">Purchase Returns</span>
        </NavLink>
        <NavLink className="context-sidebar__link" to="/inventory/suppliers">
          <span className="context-sidebar__link-text">Suppliers</span>
        </NavLink>
      </nav>
    </aside>
  );
};

export default InventorySidebar;
