import React, { useCallback, useEffect, useMemo, useState } from 'react';
import StaffExpensesHeader from '../../components/staffExpenses/StaffExpensesHeader';
import { getLocalExpenses } from '../../core/db';
import './StaffExpenses.css';

const ExpenseDailyReport = () => {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expenses, setExpenses] = useState([]);

  const loadExpenses = useCallback(async () => {
    const list = await getLocalExpenses({ from: date, to: date });
    setExpenses(list.filter((item) => !item.isDeleted));
  }, [date]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  useEffect(() => {
    const handler = () => loadExpenses();
    window.addEventListener('staff-expenses-sync-updated', handler);
    return () => window.removeEventListener('staff-expenses-sync-updated', handler);
  }, [loadExpenses]);

  const summary = useMemo(() => {
    const categoryMap = new Map();
    let total = 0;
    expenses.forEach((item) => {
      const amount = Number(item.amount || 0);
      total += amount;
      const category = item.category || 'Uncategorized';
      categoryMap.set(category, (categoryMap.get(category) || 0) + amount);
    });
    const categories = Array.from(categoryMap.entries()).map(([category, amount]) => ({
      category,
      amount,
    }));
    return { total, categories };
  }, [expenses]);

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

