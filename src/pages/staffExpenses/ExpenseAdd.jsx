import React from 'react';
import { Navigate } from 'react-router-dom';

// Canonical expense management now belongs to SHAJ Retail Hub. POS retains only
// genuine store-execution cash/register responsibilities, not expense master or
// reporting authority.
export default function ExpenseAdd() {
  return <Navigate to="/billing/retail" replace />;
}
