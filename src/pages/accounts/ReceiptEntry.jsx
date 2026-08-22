import React from 'react';
import { Navigate } from 'react-router-dom';

export default function ReceiptEntry() {
  return <Navigate to="/billing/retail" replace />;
}
