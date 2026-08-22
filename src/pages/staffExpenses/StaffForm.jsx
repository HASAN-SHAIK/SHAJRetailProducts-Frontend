import React from 'react';
import { Navigate } from 'react-router-dom';

// Canonical staff profile creation/editing is managed in SHAJ Retail Hub.
// POS must not mutate staff master data; it only consumes operator identity and
// permissions for store execution.
export default function StaffForm() {
  return <Navigate to="/billing/retail" replace />;
}
