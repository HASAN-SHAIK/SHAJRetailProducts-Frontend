import React, { useCallback, useEffect, useState } from 'react';
import StaffExpensesHeader from '../../components/staffExpenses/StaffExpensesHeader';
import { getMonthlyExpenseReport } from '../../services/local';
import './StaffExpenses.css';

const ExpenseMonthlyReport = () => {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${m}`;
  });
  const [summary, setSummary] = useState({ total: 0, categories: [] });

  const loadReport = useCallback(async () => {
    const report = await getMonthlyExpenseReport({ month });
    setSummary(report || { total: 0, categories: [] });
  }, [month]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  useEffect(() => {
    const handler = () => loadReport();
    window.addEventListener('staff-expenses-sync-updated', handler);
    return () => window.removeEventListener('staff-expenses-sync-updated', handler);
  }, [loadReport]);

  return (
    <div className="staff-expenses-page">
      <StaffExpensesHeader title="Monthly Expense Report" />
      <div className="staff-expenses-card">
        <div className="row g-2 align-items-end">
          <div className="col-md-4">
            <label className="form-label">Month</label>
            <input type="month" className="form-control" value={month} onChange={(event) => setMonth(event.target.value)} />
          </div>
          <div className="col-md-4">
            <span className="pill-badge">Total: {summary.total.toFixed(2)}</span>
          </div>
        </div>
      </div>
      <div className="staff-expenses-card">
        <h4>Category Breakdown</h4>
        <table className="staff-expenses-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {summary.categories.length === 0 && (
              <tr>
                <td colSpan={2} className="text-center text-secondary">
                  No expenses.
                </td>
              </tr>
            )}
            {summary.categories.map((row) => (
              <tr key={row.category}>
                <td>{row.category}</td>
                <td>{row.amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExpenseMonthlyReport;
