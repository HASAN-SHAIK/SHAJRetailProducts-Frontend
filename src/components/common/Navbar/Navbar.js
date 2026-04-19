import React, { useCallback, useEffect, useRef, useState } from 'react';
// import { Modal } from 'bootstrap'
import { useLocation, useNavigate } from "react-router-dom";
import './Navbar.css'
import { useSelector } from 'react-redux';
import { useBranchStore } from '../../../store/branchStore';
import { isFeatureEnabled } from '../../../utils/entitlements';


const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const tenantConfig = useSelector((state) => state.tenant.tenantConfig);
  const userRole = useSelector((state) => state.tenant.role);
  const branches = useBranchStore((state) => state.branches);
  const selectedBranchId = useBranchStore((state) => state.selectedBranchId);
  const selectedBranchName = useBranchStore((state) => state.selectedBranchName);
  const setSelectedBranchId = useBranchStore((state) => state.setSelectedBranchId);
  const reportsEnabled = isFeatureEnabled(tenantConfig, 'reports_enabled', true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [isProbingExpand, setIsProbingExpand] = useState(false);
  const branchDropdownRef = useRef(null);
  const moreDropdownRef = useRef(null);
  const settingsDropdownRef = useRef(null);
  const navActionsRef = useRef(null);
  const rafRef = useRef(null);

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
    if (!moreOpen) return;
    const handleClickOutside = (event) => {
      if (!moreDropdownRef.current?.contains(event.target)) {
        setMoreOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [moreOpen]);

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
    setMoreOpen(false);
    setSettingsOpen(false);
    navigate(route);
  };

  const isActive = (route) =>
    location.pathname === route || location.pathname.startsWith(`${route}/`);

  const hasSecondaryActive =
    isActive('/customers') ||
    isActive('/staff-expenses') ||
    isActive('/accounts') ||
    isActive('/returns-corrections') ||
    isActive('/sync-center');

  const detectWrapOrOverflow = useCallback(() => {
    const element = navActionsRef.current;
    if (!element) return false;
    const widthOverflow = element.scrollWidth - element.clientWidth > 1;
    const heightOverflow = element.scrollHeight - element.clientHeight > 1;
    return widthOverflow || heightOverflow;
  }, []);

  const evaluateMoreVisibility = useCallback(() => {
    if (window.innerWidth <= 992) {
      setShowMore(false);
      setIsProbingExpand(false);
      return;
    }

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      if (!showMore) {
        if (detectWrapOrOverflow()) {
          setShowMore(true);
          setMoreOpen(false);
        }
        return;
      }

      setIsProbingExpand(true);
      requestAnimationFrame(() => {
        const stillOverflow = detectWrapOrOverflow();
        setShowMore(stillOverflow);
        if (!stillOverflow) {
          setMoreOpen(false);
        }
        setIsProbingExpand(false);
      });
    });
  }, [detectWrapOrOverflow, showMore]);

  useEffect(() => {
    evaluateMoreVisibility();
  }, [
    evaluateMoreVisibility,
    reportsEnabled,
    selectedBranchId,
    selectedBranchName,
    branches.length,
  ]);

  useEffect(() => {
    const handleResize = () => evaluateMoreVisibility();
    window.addEventListener('resize', handleResize);
    const observer = new ResizeObserver(() => evaluateMoreVisibility());
    if (navActionsRef.current) {
      observer.observe(navActionsRef.current);
    }
    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [evaluateMoreVisibility]);


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
            <div ref={navActionsRef} className={`nav-actions${menuOpen ? ' is-open' : ''}`}>
            <div className="me-2 d-flex align-items-center nav-branch-control" ref={branchDropdownRef}>
              <div className="dropdown nav-branch-dropdown">
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
            <div className="nav-main-links">
              {reportsEnabled && (
                <button className={`btn btn-outline-primary nav-pill${isActive('/dashboard') ? ' active' : ''}`} onClick={() => navigateTo('/dashboard')}>
                  <span className="nav-pill-content">
                    <i className="bi bi-speedometer2 fs-6" aria-hidden="true" />
                    <span className="nav-pill-label">Dashboard</span>
                  </span>
                </button>
              )}
              <button className={`btn btn-outline-primary nav-pill${isActive('/orders') ? ' active' : ''}`} onClick={() => navigateTo('/orders')}>
                <span className="nav-pill-content">
                  <i className="bi bi-collection fs-6" aria-hidden="true" />
                  <span className="nav-pill-label">Orders</span>
                </span>
              </button>
              <button className={`btn btn-outline-primary nav-pill${isActive('/billing') ? ' active' : ''}`} onClick={() => navigateTo('/billing/retail')}>
                <span className="nav-pill-content">
                  <i className="bi bi-receipt fs-6" aria-hidden="true" />
                  <span className="nav-pill-label">Billing</span>
                </span>
              </button>
              <button className={`btn btn-outline-primary nav-pill${isActive('/inventory') ? ' active' : ''}`} onClick={() => navigateTo('/inventory/catalog')}>
                <span className="nav-pill-content">
                  <i className="bi bi-box-seam fs-6" aria-hidden="true" />
                  <span className="nav-pill-label">Inventory</span>
                </span>
              </button>
            </div>
            {(!showMore || isProbingExpand) && (
              <div className={`nav-secondary-links${isProbingExpand ? ' nav-probe-hidden' : ''}`}>
                <button className={`btn btn-outline-primary nav-pill${isActive('/customers') ? ' active' : ''}`} onClick={() => navigateTo('/customers')}>
                  <span className="nav-pill-content">
                    <i className="bi bi-people fs-6" aria-hidden="true" />
                    <span className="nav-pill-label">Customers</span>
                  </span>
                </button>
                <button className={`btn btn-outline-primary nav-pill${isActive('/staff-expenses') ? ' active' : ''}`} onClick={() => navigateTo('/staff-expenses/staff/list')}>
                  <span className="nav-pill-content">
                    <i className="bi bi-people-fill fs-6" aria-hidden="true" />
                    <span className="nav-pill-label">Staff & Expenses</span>
                  </span>
                </button>
                <button className={`btn btn-outline-primary nav-pill${isActive('/accounts') ? ' active' : ''}`} onClick={() => navigateTo('/accounts/receipt')}>
                  <span className="nav-pill-content">
                    <i className="bi bi-journal-text fs-6" aria-hidden="true" />
                    <span className="nav-pill-label">Accounts</span>
                  </span>
                </button>
                <button className={`btn btn-outline-primary nav-pill${isActive('/returns-corrections') ? ' active' : ''}`} onClick={() => navigateTo('/returns-corrections/returns/new')}>
                  <span className="nav-pill-content">
                    <i className="bi bi-arrow-repeat fs-6" aria-hidden="true" />
                    <span className="nav-pill-label">Adjustments</span>
                  </span>
                </button>
                <button className={`btn btn-outline-primary nav-pill${isActive('/sync-center') ? ' active' : ''}`} onClick={() => navigateTo('/sync-center')}>
                  <span className="nav-pill-content">
                    <i className="bi bi-arrow-repeat fs-6" aria-hidden="true" />
                    <span className="nav-pill-label">Sync Center</span>
                  </span>
                </button>
              </div>
            )}
            <div className="dropdown nav-settings-dropdown" ref={settingsDropdownRef}>
              <button
                className={`btn btn-outline-primary nav-pill nav-settings-pill dropdown-toggle${settingsOpen ? ' show' : ''}`}
                type="button"
                aria-expanded={settingsOpen}
                onClick={() => {
                  setMoreOpen(false);
                  setSettingsOpen((prev) => !prev);
                }}
              >
                <span className="nav-pill-content">
                  <i className="bi bi-gear fs-6" aria-hidden="true" />
                  <span className="nav-pill-label">Settings</span>
                </span>
              </button>
              <ul className={`dropdown-menu nav-settings-menu${settingsOpen ? ' show' : ''}`}>
                {userRole === 'admin' && (
                  <li>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => navigateTo('/branch-devices')}
                    >
                      <span className="nav-pill-content">
                        <i className="bi bi-shield-lock fs-6" aria-hidden="true" />
                        <span className="nav-pill-label">Devices</span>
                      </span>
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
                    <span className="nav-pill-content">
                      <i className="bi bi-box-arrow-right fs-6" aria-hidden="true" />
                      <span className="nav-pill-label">Logout</span>
                    </span>
                  </button>
                </li>
              </ul>
            </div>
            {showMore && !isProbingExpand && (
              <div className="dropdown nav-more-dropdown" ref={moreDropdownRef}>
                <button
                  className={`btn btn-outline-primary nav-pill nav-more-pill dropdown-toggle${moreOpen ? ' show' : ''}${hasSecondaryActive ? ' active' : ''}`}
                  type="button"
                  aria-expanded={moreOpen}
                  onClick={() => {
                    setSettingsOpen(false);
                    setMoreOpen((prev) => !prev);
                  }}
                >
                  <span className="nav-pill-content">
                    <i className="bi bi-grid-3x3-gap fs-6" aria-hidden="true" />
                    <span className="nav-pill-label">More</span>
                  </span>
                </button>
                <ul className={`dropdown-menu nav-more-menu${moreOpen ? ' show' : ''}`}>
                  <li>
                    <button type="button" className="dropdown-item" onClick={() => navigateTo('/customers')}>
                      <span className="nav-pill-content">
                        <i className="bi bi-people fs-6" aria-hidden="true" />
                        <span className="nav-pill-label">Customers</span>
                      </span>
                    </button>
                  </li>
                  <li>
                    <button type="button" className="dropdown-item" onClick={() => navigateTo('/staff-expenses/staff/list')}>
                      <span className="nav-pill-content">
                        <i className="bi bi-people-fill fs-6" aria-hidden="true" />
                        <span className="nav-pill-label">Staff & Expenses</span>
                      </span>
                    </button>
                  </li>
                  <li>
                    <button type="button" className="dropdown-item" onClick={() => navigateTo('/accounts/receipt')}>
                      <span className="nav-pill-content">
                        <i className="bi bi-journal-text fs-6" aria-hidden="true" />
                        <span className="nav-pill-label">Accounts</span>
                      </span>
                    </button>
                  </li>
                  <li>
                    <button type="button" className="dropdown-item" onClick={() => navigateTo('/returns-corrections/returns/new')}>
                      <span className="nav-pill-content">
                        <i className="bi bi-arrow-repeat fs-6" aria-hidden="true" />
                        <span className="nav-pill-label">Adjustments</span>
                      </span>
                    </button>
                  </li>
                  <li>
                    <button type="button" className="dropdown-item" onClick={() => navigateTo('/sync-center')}>
                      <span className="nav-pill-content">
                        <i className="bi bi-arrow-repeat fs-6" aria-hidden="true" />
                        <span className="nav-pill-label">Sync Center</span>
                      </span>
                    </button>
                  </li>
                </ul>
              </div>
            )}
            </div>
        </div>
    </div>
  );
};

export default Navbar;
