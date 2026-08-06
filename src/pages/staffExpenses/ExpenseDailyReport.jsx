import React, { useCallback, useEffect, useState } from 'react';
import StaffExpensesHeader from '../../components/staffExpenses/StaffExpensesHeader';
import { getDailyExpenseReport } from '../../services/local';
import './StaffExpenses.css';

const ExpenseDailyReport = () => {
  const [date, setDate] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [summary, setSummary] = useState({ total: 0, categories: [] });

  const loadReport = useCallback(async () => {
    const report = await getDailyExpenseReport({ date });
    setSummary(report || { total: 0, categories: [] });
  }, [date]);

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
      <StaffExpensesHeader title="Daily Expense Report" />
      <div className="staff-expenses-card">
        <div className="row g-2 align-items-end">
          <div className="col-md-4">
            <label className="form-label">Date</label>
            <input type="date" className="form-control" value={date} onChange={(event) => setDate(event.target.value)} />
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

export default ExpenseDailyReport;
