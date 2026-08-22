import React from 'react';
import { Navigate } from 'react-router-dom';

// Salary/staff-management views are part of SHAJ Retail Hub. POS keeps no
// staff administration authority beyond the currently authenticated operator's
// execution permissions.
export default function SalaryTracking() {
  return <Navigate to="/billing/retail" replace />;
}
