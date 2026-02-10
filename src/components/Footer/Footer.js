// src/pages/Login/Login.js

import React, { useState } from 'react';
import logo from '../../Images/logo.png';

const Footer = ( ) => {
  return (
        <footer className="footer">
          <div><img className="p-2" src={logo} alt="SHAJ Logo" width="100" height="50"/>
          &copy; SHAJ Retail Products. All rights reserved.</div>
        </footer>
  );
};

export default Footer;