import React from 'react';
import { Navigate } from 'react-router-dom';

// Staff administration now belongs to SHAJ Retail Hub. POS keeps only the
// authenticated operator identity and runtime permission enforcement required
// for store execution.
export default function StaffList() {
  return <Navigate to="/billing/retail" replace />;
}
