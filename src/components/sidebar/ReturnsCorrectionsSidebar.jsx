import React from 'react';
import { NavLink } from 'react-router-dom';

const ReturnsCorrectionsSidebar = ({ collapsed, onToggle }) => {
  return (
    <aside className={`context-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="context-sidebar__header">
        <div className="context-sidebar__title">Returns & Corrections</div>
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
        <NavLink className="context-sidebar__link" to="/returns-corrections/returns/new">
          <span className="context-sidebar__link-text">Sales Return</span>
        </NavLink>
        <NavLink className="context-sidebar__link" to="/returns-corrections/returns/history">
          <span className="context-sidebar__link-text">Return History</span>
        </NavLink>
        <div className="context-sidebar__section">Corrections</div>
        <NavLink className="context-sidebar__link" to="/returns-corrections/corrections/edit">
          <span className="context-sidebar__link-text">Edit Bill</span>
        </NavLink>
        <NavLink className="context-sidebar__link" to="/returns-corrections/corrections/history">
          <span className="context-sidebar__link-text">Correction History</span>
        </NavLink>
        <div className="context-sidebar__section">GST & Compliance</div>
        <NavLink className="context-sidebar__link" to="/returns-corrections/gst/reports">
          <span className="context-sidebar__link-text">Tax Reports</span>
        </NavLink>
        <NavLink className="context-sidebar__link" to="/returns-corrections/gst/summary">
          <span className="context-sidebar__link-text">GST Summary</span>
        </NavLink>
        <NavLink className="context-sidebar__link" to="/returns-corrections/gst/eway">
          <span className="context-sidebar__link-text">E-Way Bill</span>
        </NavLink>
        <NavLink className="context-sidebar__link" to="/returns-corrections/gst/filing">
          <span className="context-sidebar__link-text">GST Filing Data</span>
        </NavLink>
      </nav>
    </aside>
  );
};

export default ReturnsCorrectionsSidebar;
