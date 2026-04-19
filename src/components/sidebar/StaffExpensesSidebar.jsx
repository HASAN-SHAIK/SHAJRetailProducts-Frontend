import React from 'react';
import { NavLink } from 'react-router-dom';

const StaffExpensesSidebar = ({ collapsed, onToggle }) => {
  return (
    <aside className={`context-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="context-sidebar__header">
        <div className="context-sidebar__title">Staff & Expenses</div>
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
        <div className="context-sidebar__section">Staff</div>
        <NavLink className="context-sidebar__link" to="/staff-expenses/staff/list">
          <span className="context-sidebar__link-text">Staff List</span>
        </NavLink>
        <NavLink className="context-sidebar__link" to="/staff-expenses/staff/add">
          <span className="context-sidebar__link-text">Add Staff</span>
        </NavLink>
        <NavLink className="context-sidebar__link" to="/staff-expenses/staff/salary">
          <span className="context-sidebar__link-text">Salary Tracking</span>
        </NavLink>
        <div className="context-sidebar__section">Expenses</div>
        <NavLink className="context-sidebar__link" to="/staff-expenses/expenses/add">
          <span className="context-sidebar__link-text">Add Expense</span>
        </NavLink>
        <NavLink className="context-sidebar__link" to="/staff-expenses/expenses/daily">
          <span className="context-sidebar__link-text">Daily Report</span>
        </NavLink>
        <NavLink className="context-sidebar__link" to="/staff-expenses/expenses/monthly">
          <span className="context-sidebar__link-text">Monthly Report</span>
        </NavLink>
        <NavLink className="context-sidebar__link" to="/staff-expenses/expenses/staff-wise">
          <span className="context-sidebar__link-text">Staff-wise Expenses</span>
        </NavLink>
      </nav>
    </aside>
  );
};

export default StaffExpensesSidebar;
