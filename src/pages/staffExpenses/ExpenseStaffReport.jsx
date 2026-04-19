import React, { useCallback, useEffect, useMemo, useState } from 'react';
import StaffExpensesHeader from '../../components/staffExpenses/StaffExpensesHeader';
import { getLocalExpenses, getLocalStaff } from '../../core/db';
import './StaffExpenses.css';

const ExpenseStaffReport = () => {
  const [staff, setStaff] = useState([]);
  const [staffId, setStaffId] = useState('');
  const [expenses, setExpenses] = useState([]);

  const loadStaff = useCallback(async () => {
    const list = await getLocalStaff({});
    setStaff(list.filter((item) => !item.isDeleted));
  }, []);

  const loadExpenses = useCallback(async () => {
    const list = await getLocalExpenses({ type: 'staff', staffId: staffId || undefined });
    setExpenses(list.filter((item) => !item.isDeleted));
  }, [staffId]);

  useEffect(() => {
    loadStaff();
    loadExpenses();
  }, [loadStaff, loadExpenses]);

  useEffect(() => {
    const handler = () => loadExpenses();
    window.addEventListener('staff-expenses-sync-updated', handler);
    return () => window.removeEventListener('staff-expenses-sync-updated', handler);
  }, [loadExpenses]);

  const total = useMemo(
    () => expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [expenses]
  );

  return (
    <div className="staff-expenses-page">
      <StaffExpensesHeader title="Staff-wise Expenses" />
      <div className="staff-expenses-card">
        <div className="row g-2 align-items-end">
          <div className="col-md-4">
            <label className="form-label">Staff</label>
            <select className="form-select" value={staffId} onChange={(event) => setStaffId(event.target.value)}>
              <option value="">All</option>
              {staff.map((item) => (
                <option key={item.staffId} value={item.staffId}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <span className="pill-badge">Total: {total.toFixed(2)}</span>
          </div>
        </div>
      </div>
      <div className="staff-expenses-card">
        <table className="staff-expenses-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Date</th>
              <th>Staff</th>
              <th>Category</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-secondary">
                  No expenses.
                </td>
              </tr>
            )}
            {expenses.map((item) => {
              const staffName = staff.find((s) => s.staffId === item.staffId)?.name || '-';
              return (
                <tr key={item.expenseId}>
                  <td>
                    <span className={`sync-dot ${item.isSynced ? 'synced' : ''}`}>
                      {item.isSynced ? 'Synced' : 'Not Synced'}
                    </span>
                  </td>
                  <td>{item.date}</td>
                  <td>{staffName}</td>
                  <td>{item.category}</td>
                  <td>{Number(item.amount || 0).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExpenseStaffReport;

