import React from 'react';
import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  canAccessModule,
  isPosRestrictedRole,
  getStoredSessionUser,
} from '../../utils/permissions';
import { getVisibleMobileModules } from './mobileModuleNavPolicy';

export {
  canAccessModule,
  isPosRestrictedRole,
  getVisibleMobileModules,
};

const MobileModuleNav = ({ onItemClick, isOpeningCompleted = true, user: propUser }) => {
  const storeUser = useSelector((state) => state?.user?.userDetails);
  const userRole = useSelector((state) => state?.tenant?.role);
  const user =
    propUser !== undefined
      ? propUser
      : storeUser || getStoredSessionUser() || (userRole ? { role: userRole } : null);

  const visible = getVisibleMobileModules({ user, isOpeningCompleted });

  return (
    <div className="context-sidebar__mobile-nav">
      <div className="context-sidebar__section">Modules</div>
      {visible.billing && (
        <NavLink className="context-sidebar__link" to="/billing/retail" onClick={onItemClick}>
          <i className="bi bi-receipt" aria-hidden="true" />
          <span className="context-sidebar__link-text">Billing</span>
        </NavLink>
      )}
      {visible.orders && (
        <NavLink className="context-sidebar__link" to="/orders/sales" onClick={onItemClick}>
          <i className="bi bi-collection" aria-hidden="true" />
          <span className="context-sidebar__link-text">Orders</span>
        </NavLink>
      )}
      {visible.inventory && (
        <NavLink className="context-sidebar__link" to="/inventory/catalog" onClick={onItemClick}>
          <i className="bi bi-box-seam" aria-hidden="true" />
          <span className="context-sidebar__link-text">Inventory</span>
        </NavLink>
      )}
      {visible.customers && (
        <NavLink className="context-sidebar__link" to="/customers" onClick={onItemClick}>
          <i className="bi bi-people" aria-hidden="true" />
          <span className="context-sidebar__link-text">Customers</span>
        </NavLink>
      )}
      {visible.accounts && (
        <NavLink className="context-sidebar__link" to="/accounts/receipt" onClick={onItemClick}>
          <i className="bi bi-wallet2" aria-hidden="true" />
          <span className="context-sidebar__link-text">Accounts</span>
        </NavLink>
      )}
      {visible.adjustments && (
        <NavLink className="context-sidebar__link" to="/returns-corrections/returns/new" onClick={onItemClick}>
          <i className="bi bi-arrow-repeat" aria-hidden="true" />
          <span className="context-sidebar__link-text">Adjustments</span>
        </NavLink>
      )}
      {visible.syncCenter && (
        <NavLink className="context-sidebar__link" to="/sync-center" onClick={onItemClick}>
          <i className="bi bi-cloud-arrow-up" aria-hidden="true" />
          <span className="context-sidebar__link-text">Sync Center</span>
        </NavLink>
      )}
    </div>
  );
};

export default MobileModuleNav;
