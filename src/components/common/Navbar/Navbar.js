import React, { useState } from 'react';
// import { Modal } from 'bootstrap'
import { useNavigate } from "react-router-dom";
import './Navbar.css'
import logo from '../../../Images/logo.png';
import { useDispatch } from 'react-redux';


const Navbar = () => {
      const navigate = useNavigate();
      const navigateTo = (route) => {
        navigate(route);
      };

    

  return (
    <div className='navbar-style'>
        <div className="custom-navbar d-flex justify-content-between align-items-center sticky-top">
            <div className="nav-left d-flex align-items-center">
              <img src={logo} className='my-1 nav-logo' alt="SHAJ Logo" width="100" height="50"/>
              <button onClick={() => navigateTo('/dashboard')} className='m-1 btn companyName fs-3 btn-block'>
              {/* <i class="bi bi-motherboard fs-3 m-1"></i> */}
              Ameena Automobiles</button>
            </div>
             <button className="btn newOrderBtn fw-bold nav-cta" onClick={() => navigateTo('/neworder')}>
              <span className='fs-3'>New Order</span>
           </button>
            <div className="btn-group nav-actions">
            <button className="btn btn-outline-primary nav-pill" onClick={() => navigateTo('/dashboard')}><i class="bi bi-speedometer2 fs-6"><span className='m-1'>Dashboard</span></i></button>
            <button className="btn btn-outline-primary nav-pill" onClick={() => navigateTo('/orders')}><i class="bi bi-collection fs-6"><span className='m-1'>Orders</span></i></button>
            <button className="btn btn-outline-primary nav-pill" onClick={() => navigateTo('/products')}><i class="bi bi-box-seam fs-6"><span className='m-1'>Products</span></i></button>
            <button className="btn btn-outline-primary nav-pill" onClick={() => navigateTo('/transactions')}><i class="bi bi-credit-card fs-6"><span className='m-1'>Transactions</span></i></button>
            <button className="btn btn-outline-danger nav-pill" onClick={async() =>{navigate('/logout')}}><i class="bi bi-box-arrow-right fs-6"><span className='m-1'>Logout</span></i></button>
            </div>
        </div>
    </div>
  );
};

export default Navbar;
