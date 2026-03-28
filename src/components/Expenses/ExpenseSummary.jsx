import React from 'react';

const ExpenseSummary = ({ dailyTotal, monthlyTotal, formatMoney }) => (
  <div className="expense-summary">
    <div className="summary-card">
      <span>Daily Total</span>
      <strong>{formatMoney(dailyTotal)}</strong>
    </div>
    <div className="summary-card">
      <span>Monthly Total</span>
      <strong>{formatMoney(monthlyTotal)}</strong>
    </div>
  </div>
);

export default ExpenseSummary;
