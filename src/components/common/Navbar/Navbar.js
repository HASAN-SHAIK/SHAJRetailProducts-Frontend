import React from 'react';
// import { Modal } from 'bootstrap'
import { useLocation, useNavigate } from "react-router-dom";
import './Navbar.css'
import logo from '../../../Images/logo.png';
import { useSelector } from 'react-redux';
import { useBranchStore } from '../../../store/branchStore';


const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const tenantConfig = useSelector((state) => state.tenant.tenantConfig);
  const userRole = useSelector((state) => state.tenant.role);
  const branches = useBranchStore((state) => state.branches);
  const selectedBranchId = useBranchStore((state) => state.selectedBranchId);
  const setSelectedBranchId = useBranchStore((state) => state.setSelectedBranchId);
  const planFeatures = tenantConfig?.plan_features || tenantConfig || {};
  const reportsEnabled =
    planFeatures.advanced_reports === true ||
    planFeatures.analytical_reports === true ||
    tenantConfig?.enable_reports !== false;
  const shopName =
    tenantConfig?.shop_name ||
    tenantConfig?.tenant_name ||
    tenantConfig?.display_name ||
    'SHAJRetail NextGen';
  const navigateTo = (route) => {
    navigate(route);
  };

  const isActive = (route) => location.pathname === route;
    

  return (
    <div className='navbar-style'>
        <div className="custom-navbar d-flex justify-content-between align-items-center sticky-top">
            <div className="nav-left d-flex align-items-center">
              <img src={logo} className='my-1 nav-logo' alt="SHAJ Logo" width="100" height="50"/>
              {/* <button onClick={() => navigateTo('/dashboard')} className='m-1 btn companyName tenant-name fs-3 btn-block'>
              {shopName}</button> */}
            </div>
             {/* <button className="btn newOrderBtn fw-bold nav-cta" onClick={() => navigateTo('/neworder')}>
              <span className='fs-3'>New Order</span>
           </button> */}
            <div className="btn-group nav-actions">
            <div className="me-2 d-flex align-items-center">
              <select
                className="form-select form-select-sm"
                value={selectedBranchId || ''}
                onChange={(event) => setSelectedBranchId(event.target.value || null)}
              >
                <option value="">Select Branch</option>
                {userRole === 'admin' && <option value="all">All</option>}
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            {reportsEnabled && (
              <button className={`btn btn-outline-primary nav-pill${isActive('/dashboard') ? ' active' : ''}`} onClick={() => navigateTo('/dashboard')}>
                <i class="bi bi-speedometer2 fs-6"><span className='m-1'>Dashboard</span></i>
              </button>
            )}
            <button className={`btn btn-outline-primary nav-pill${isActive('/orders') ? ' active' : ''}`} onClick={() => navigateTo('/orders')}><i class="bi bi-collection fs-6"><span className='m-1'>Orders</span></i></button>
            <button className={`btn btn-outline-primary nav-pill nav-expenses${isActive('/expenses') ? ' active' : ''}`} onClick={() => navigateTo('/expenses')}><i class="bi bi-cash-stack fs-6"><span className='m-1'>Expenses</span></i></button>
            <button className={`btn btn-outline-primary nav-pill${isActive('/billing') ? ' active' : ''}`} onClick={() => navigateTo('/billing')}><i class="bi bi-receipt fs-6"><span className='m-1'>Billing</span></i></button>
            <button className={`btn btn-outline-primary nav-pill${isActive('/products') ? ' active' : ''}`} onClick={() => navigateTo('/products')}><i class="bi bi-box-seam fs-6"><span className='m-1'>Products</span></i></button>
            <button className={`btn btn-outline-primary nav-pill${isActive('/transactions') ? ' active' : ''}`} onClick={() => navigateTo('/transactions')}><i class="bi bi-credit-card fs-6"><span className='m-1'>Transactions</span></i></button>
            <button className="btn btn-outline-danger nav-pill" onClick={async() =>{navigate('/logout')}}><i class="bi bi-box-arrow-right fs-6"><span className='m-1'>Logout</span></i></button>
            </div>
        </div>
    </div>
  );
};

export default Navbar;
