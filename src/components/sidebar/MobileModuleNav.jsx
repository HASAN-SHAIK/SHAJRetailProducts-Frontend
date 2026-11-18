import React from 'react';
import { NavLink } from 'react-router-dom';

const MobileModuleNav = ({ onItemClick }) => {
  return (
    <div className="context-sidebar__mobile-nav">
      <div className="context-sidebar__section">Modules</div>
      <NavLink className="context-sidebar__link" to="/billing/retail" onClick={onItemClick}>
        <i className="bi bi-receipt" aria-hidden="true" />
        <span className="context-sidebar__link-text">Billing</span>
      </NavLink>
      <NavLink className="context-sidebar__link" to="/orders/sales" onClick={onItemClick}>
        <i className="bi bi-collection" aria-hidden="true" />
        <span className="context-sidebar__link-text">Orders</span>
      </NavLink>
      <NavLink className="context-sidebar__link" to="/inventory/catalog" onClick={onItemClick}>
        <i className="bi bi-box-seam" aria-hidden="true" />
        <span className="context-sidebar__link-text">Inventory</span>
      </NavLink>
      <NavLink className="context-sidebar__link" to="/customers" onClick={onItemClick}>
        <i className="bi bi-people" aria-hidden="true" />
        <span className="context-sidebar__link-text">Customers</span>
      </NavLink>
      <NavLink className="context-sidebar__link" to="/accounts/receipt" onClick={onItemClick}>
        <i className="bi bi-wallet2" aria-hidden="true" />
        <span className="context-sidebar__link-text">Accounts</span>
      </NavLink>
      <NavLink className="context-sidebar__link" to="/returns-corrections/returns/new" onClick={onItemClick}>
        <i className="bi bi-arrow-repeat" aria-hidden="true" />
        <span className="context-sidebar__link-text">Adjustments</span>
      </NavLink>
      <NavLink className="context-sidebar__link" to="/sync-center" onClick={onItemClick}>
        <i className="bi bi-cloud-arrow-up" aria-hidden="true" />
        <span className="context-sidebar__link-text">Sync Center</span>
      </NavLink>
    </div>
  );
};

export default MobileModuleNav;
