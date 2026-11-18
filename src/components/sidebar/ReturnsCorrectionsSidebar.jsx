import React from 'react';
import { NavLink } from 'react-router-dom';
import MobileModuleNav from './MobileModuleNav';

const ReturnsCorrectionsSidebar = ({ collapsed, onToggle, isDrawerOpen, onCloseDrawer, onItemClick }) => {
  return (
    <aside className={`context-sidebar ${collapsed ? 'collapsed' : ''} ${isDrawerOpen ? 'drawer-open' : ''}`}>
      <div className="context-sidebar__header">
        <div className="context-sidebar__title">Returns & Corrections</div>
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
        <div className="context-sidebar__section">Returns</div>
        <NavLink className="context-sidebar__link" to="/returns-corrections/returns/new" onClick={onItemClick}>
          <span className="context-sidebar__link-text">Sales Return</span>
        </NavLink>
        <NavLink className="context-sidebar__link" to="/returns-corrections/returns/history" onClick={onItemClick}>
          <span className="context-sidebar__link-text">Return History</span>
        </NavLink>
        <div className="context-sidebar__section">Corrections</div>
        <NavLink className="context-sidebar__link" to="/returns-corrections/corrections/edit" onClick={onItemClick}>
          <span className="context-sidebar__link-text">Edit Bill</span>
        </NavLink>
        <NavLink className="context-sidebar__link" to="/returns-corrections/corrections/history" onClick={onItemClick}>
          <span className="context-sidebar__link-text">Correction History</span>
        </NavLink>
        <div className="context-sidebar__section">GST & Compliance</div>
        <NavLink className="context-sidebar__link" to="/returns-corrections/gst/reports" onClick={onItemClick}>
          <span className="context-sidebar__link-text">Tax Reports</span>
        </NavLink>
        <NavLink className="context-sidebar__link" to="/returns-corrections/gst/summary" onClick={onItemClick}>
          <span className="context-sidebar__link-text">GST Summary</span>
        </NavLink>
        <NavLink className="context-sidebar__link" to="/returns-corrections/gst/eway" onClick={onItemClick}>
          <span className="context-sidebar__link-text">E-Way Bill</span>
        </NavLink>
        <NavLink className="context-sidebar__link" to="/returns-corrections/gst/filing" onClick={onItemClick}>
          <span className="context-sidebar__link-text">GST Filing Data</span>
        </NavLink>
      </nav>
      <MobileModuleNav onItemClick={onItemClick} />
    </aside>
  );
};

export default ReturnsCorrectionsSidebar;
