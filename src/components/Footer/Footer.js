// src/pages/Login/Login.js

import React, { useState } from 'react';
import logo from '../../Images/logo.png';

const Footer = ( ) => {
  return (
        <footer className="footer">
          <div className="d-flex align-items-center justify-content-center gap-2">
            <img src={logo} alt="SHAJ Logo" width="36" height="36" style={{ borderRadius: 8, objectFit: 'contain' }}/>
            <span>&copy; SHAJ Retail Products. All rights reserved.</span>
          </div>
        </footer>
  );
};

export default Footer;