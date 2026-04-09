import React, { useCallback, useEffect, useMemo, useState } from 'react';
import StaffExpensesHeader from '../../components/staffExpenses/StaffExpensesHeader';
import { getLocalExpenses } from '../../core/db';
import './StaffExpenses.css';

const monthRange = (monthValue) => {
  const [yearRaw, monthRaw] = String(monthValue || '').split('-');
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return { from: null, to: null };
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  const toIso = (date) => date.toISOString().slice(0, 10);
  return { from: toIso(start), to: toIso(end) };
};

const ExpenseMonthlyReport = () => {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${m}`;
  });
  const [expenses, setExpenses] = useState([]);

  const loadExpenses = useCallback(async () => {
    const range = monthRange(month);
    if (!range.from || !range.to) {
      setExpenses([]);
      return;
    }
    const list = await getLocalExpenses({ from: range.from, to: range.to });
    setExpenses(list.filter((item) => !item.isDeleted));
  }, [month]);

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

