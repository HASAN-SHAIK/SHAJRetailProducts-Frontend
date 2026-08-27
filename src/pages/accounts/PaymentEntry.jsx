import React from 'react';
import { Navigate } from 'react-router-dom';

export default function PaymentEntry() {
  return <Navigate to="/billing/retail" replace />;
}
