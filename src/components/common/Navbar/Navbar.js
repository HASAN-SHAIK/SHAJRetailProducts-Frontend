import React, { useEffect, useRef, useState } from 'react';
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
  const selectedBranchName = useBranchStore((state) => state.selectedBranchName);
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const branchDropdownRef = useRef(null);
  const settingsDropdownRef = useRef(null);

  const currentBranchLabel = (() => {
    if (selectedBranchId === 'all') return 'All';
    if (selectedBranchName) return selectedBranchName;
    const match = branches.find((branch) => String(branch.id) === String(selectedBranchId));
    return match?.name || 'Select Branch';
  })();

  useEffect(() => {
    if (!branchOpen) return;
    const handleClickOutside = (event) => {
      if (!branchDropdownRef.current?.contains(event.target)) {
        setBranchOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [branchOpen]);

  useEffect(() => {
    if (!settingsOpen) return;
    const handleClickOutside = (event) => {
      if (!settingsDropdownRef.current?.contains(event.target)) {
        setSettingsOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [settingsOpen]);

  const handleBranchSelect = (value, name, confirmed = true) => {
    setSelectedBranchId(value, { confirmed, name: name || '' });
    setBranchOpen(false);
  };

  const navigateTo = (route) => {
    setMenuOpen(false);
    setSettingsOpen(false);
    navigate(route);
  };

  const isActive = (route) =>
    location.pathname === route || location.pathname.startsWith(`${route}/`);
    

  return (
    <div className='navbar-style'>
        <div className="custom-navbar d-flex justify-content-between align-items-center sticky-top">
            {/* <div className="nav-left d-flex align-items-center"> */}
              {/* <img src={logo} className='my-1 nav-logo' alt="SHAJ Logo" width="100" height="50"/> */}
              {/* <button onClick={() => navigateTo('/dashboard')} className='m-1 btn companyName tenant-name fs-3 btn-block'>
              {shopName}</button> */}
            {/* </div> */}
            <button
              type="button"
              className={`nav-toggle${menuOpen ? ' is-open' : ''}`}
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="Toggle navigation"
              aria-expanded={menuOpen}
            >
              <span />
              <span />
              <span />
            </button>
             {/* <button className="btn newOrderBtn fw-bold nav-cta" onClick={() => navigateTo('/neworder')}>
              <span className='fs-3'>New Order</span>
           </button> */}
            <div className={`btn-group nav-actions${menuOpen ? ' is-open' : ''}`}>
            <div className="me-2 d-flex align-items-center nav-branch-control">
              <div className="dropdown nav-branch-dropdown" ref={branchDropdownRef}>
                <button
                  className={`btn nav-branch-pill dropdown-toggle${branchOpen ? ' show' : ''}`}
                  type="button"
                  aria-expanded={branchOpen}
                  onClick={() => setBranchOpen((prev) => !prev)}
                >
                  {currentBranchLabel}
                </button>
                <ul className={`dropdown-menu nav-branch-menu${branchOpen ? ' show' : ''}`}>
                  <li>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleBranchSelect(null, '', false)}
                    >
                      Select Branch
                    </button>
                  </li>
                  {userRole === 'admin' && (
                    <li>
                      <button
                        type="button"
                        className="dropdown-item"
                        onClick={() => handleBranchSelect('all', 'All', true)}
                      >
                        All
                      </button>
                    </li>
                  )}
                  {selectedBranchId &&
                    !branches.some((branch) => String(branch.id) === String(selectedBranchId)) &&
                    selectedBranchId !== 'all' && (
                      <li>
                        <button
                          type="button"
                          className="dropdown-item"
                          onClick={() =>
                            handleBranchSelect(
                              String(selectedBranchId),
                              selectedBranchName || 'Selected Branch',
                              true
                            )
                          }
                        >
                          {selectedBranchName || 'Selected Branch'}
                        </button>
                      </li>
                    )}
                  {branches.map((branch) => (
                    <li key={branch.id}>
                      <button
                        type="button"
                        className="dropdown-item"
                        onClick={() =>
                          handleBranchSelect(String(branch.id), branch.name || '', true)
                        }
                      >
                        {branch.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {reportsEnabled && (
              <button className={`btn btn-outline-primary nav-pill${isActive('/dashboard') ? ' active' : ''}`} onClick={() => navigateTo('/dashboard')}>
                <i class="bi bi-speedometer2 fs-6"><span className='m-1'>Dashboard</span></i>
              </button>
            )}
            <button className={`btn btn-outline-primary nav-pill${isActive('/orders') ? ' active' : ''}`} onClick={() => navigateTo('/orders')}><i class="bi bi-collection fs-6"><span className='m-1'>Orders</span></i></button>
            <button className={`btn btn-outline-primary nav-pill${isActive('/billing') ? ' active' : ''}`} onClick={() => navigateTo('/billing/retail')}><i class="bi bi-receipt fs-6"><span className='m-1'>Billing</span></i></button>
            <button className={`btn btn-outline-primary nav-pill${isActive('/inventory') ? ' active' : ''}`} onClick={() => navigateTo('/inventory/catalog')}><i class="bi bi-box-seam fs-6"><span className='m-1'>Inventory</span></i></button>
            <button className={`btn btn-outline-primary nav-pill${isActive('/customers') ? ' active' : ''}`} onClick={() => navigateTo('/customers')}><i class="bi bi-people fs-6"><span className='m-1'>Customers</span></i></button>
            <button className={`btn btn-outline-primary nav-pill${isActive('/staff-expenses') ? ' active' : ''}`} onClick={() => navigateTo('/staff-expenses/staff/list')}><i class="bi bi-people-fill fs-6"><span className='m-1'>Staff & Expenses</span></i></button>
            <button className={`btn btn-outline-primary nav-pill${isActive('/accounts') ? ' active' : ''}`} onClick={() => navigateTo('/accounts/receipt')}><i class="bi bi-journal-text fs-6"><span className='m-1'>Accounts</span></i></button>
            <button className={`btn btn-outline-primary nav-pill${isActive('/returns-corrections') ? ' active' : ''}`} onClick={() => navigateTo('/returns-corrections/returns/new')}><i class="bi bi-arrow-repeat fs-6"><span className='m-1'>Adjustments</span></i></button>
            <div className="dropdown nav-settings-dropdown" ref={settingsDropdownRef}>
              <button
                className={`btn btn-outline-primary nav-pill nav-settings-pill dropdown-toggle${settingsOpen ? ' show' : ''}`}
                type="button"
                aria-expanded={settingsOpen}
                onClick={() => setSettingsOpen((prev) => !prev)}
              >
                <i class="bi bi-gear fs-6"><span className='m-1'>Settings</span></i>
              </button>
              <ul className={`dropdown-menu nav-settings-menu${settingsOpen ? ' show' : ''}`}>
                {userRole === 'admin' && (
                  <li>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => navigateTo('/branch-devices')}
                    >
                      <i class="bi bi-shield-lock fs-6"><span className='m-1'>Devices</span></i>
                    </button>
                  </li>
                )}
                <li>
                  <button
                    type="button"
                    className="dropdown-item text-danger"
                    onClick={async() => {
                      setMenuOpen(false);
                      setSettingsOpen(false);
                      navigate('/logout');
                    }}
                  >
                    <i class="bi bi-box-arrow-right fs-6"><span className='m-1'>Logout</span></i>
                  </button>
                </li>
              </ul>
            </div>
            </div>
        </div>
    </div>
  );
};

export default Navbar;
