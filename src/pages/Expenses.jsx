import React, { useCallback, useEffect, useState } from 'react';
import { usePopup } from '../components/common/PopUp/PopupProvider';
import ExpenseForm from '../components/Expenses/ExpenseForm';
import ExpenseTable from '../components/Expenses/ExpenseTable';
import ExpenseSummary from '../components/Expenses/ExpenseSummary';
import { addExpense, getExpenseSummary, getExpenses } from '../services/expenseService';
import './Expenses.css';

const Expenses = () => {
  const { showPopup } = usePopup();
  const [expenses, setExpenses] = useState([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [summary, setSummary] = useState({ daily_total: 0, monthly_total: 0 });
  const [staffExpenses, setStaffExpenses] = useState([]);
  const [staffMonth, setStaffMonth] = useState(() => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${month}`;
  });
  const [staffName, setStaffName] = useState('');
  const [staffLoading, setStaffLoading] = useState(false);

  const formatDate = useCallback((value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }, []);

  const formatMoney = useCallback((value) => {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(Number.isFinite(amount) ? amount : 0);
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      const res = await getExpenseSummary();
      const payload = res?.summary || res?.data?.summary || res?.data || {};
      setSummary({
        daily_total: payload.daily_total || 0,
        monthly_total: payload.monthly_total || 0,
      });
    } catch {
      setSummary({ daily_total: 0, monthly_total: 0 });
    }
  }, []);

  const loadExpenses = useCallback(async () => {
    try {
      const params = {
        type: typeFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      };
      const res = await getExpenses(params);
      const payload = res?.expenses || res?.data?.expenses || res?.data || [];
      setExpenses(Array.isArray(payload) ? payload : []);
    } catch {
      setExpenses([]);
      showPopup('Failed to load expenses.', 'Error');
    }
  }, [typeFilter, fromDate, toDate, showPopup]);

  const getMonthRange = (monthValue) => {
    if (!monthValue) return { from: undefined, to: undefined };
    const [yearRaw, monthRaw] = String(monthValue).split('-');
    const year = Number(yearRaw);
    const monthIndex = Number(monthRaw) - 1;
    if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
      return { from: undefined, to: undefined };
    }
    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0);
    const toIso = (date) => date.toISOString().slice(0, 10);
    return { from: toIso(start), to: toIso(end) };
  };

  const loadStaffExpenses = useCallback(async () => {
    try {
      setStaffLoading(true);
      const range = getMonthRange(staffMonth);
      const params = {
        type: 'staff',
        name: staffName.trim() || undefined,
        from: range.from,
        to: range.to,
      };
      const res = await getExpenses(params);
      const payload = res?.expenses || res?.data?.expenses || res?.data || [];
      setStaffExpenses(Array.isArray(payload) ? payload : []);
    } catch {
      setStaffExpenses([]);
      showPopup('Failed to load staff expenses.', 'Error');
    } finally {
      setStaffLoading(false);
    }
  }, [staffMonth, staffName, showPopup]);

  useEffect(() => {
    loadSummary();
    loadExpenses();
  }, [loadSummary, loadExpenses]);

  useEffect(() => {
    loadStaffExpenses();
  }, [loadStaffExpenses]);

  const staffTotal = staffExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const handleAddExpense = async (payload) => {
    setIsSubmitting(true);
    try {
      await addExpense(payload);
      showPopup('Expense added.', 'Success');
      loadExpenses();
      loadSummary();
    } catch (err) {
      const message = err?.response?.data?.error || 'Failed to add expense.';
      showPopup(message, 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="expenses-page">
      <div className="expenses-header">
        <h2>Expenses</h2>
      </div>

      <ExpenseSummary
        dailyTotal={summary.daily_total}
        monthlyTotal={summary.monthly_total}
        formatMoney={formatMoney}
      />

      <div className="expense-filters">
        <div className="row g-2">
          <div className="col-md-3">
            <label className="form-label">Type</label>
            <select
              className="form-select"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="">All</option>
              <option value="staff">Staff</option>
              <option value="shop">Shop</option>
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label">From</label>
            <input
              type="date"
              className="form-control"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">To</label>
            <input
              type="date"
              className="form-control"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
            />
          </div>
          <div className="col-md-3 d-flex align-items-end">
            <button className="btn btn-outline-primary w-100" type="button" onClick={loadExpenses}>
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      <div className="expense-card">
        <ExpenseForm onSubmit={handleAddExpense} isSubmitting={isSubmitting} />
      </div>

      <div className="expense-card">
        <ExpenseTable expenses={expenses} formatDate={formatDate} formatMoney={formatMoney} />
      </div>

      <div className="expense-card">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
          <h4 className="m-0">Staff Expenses Report</h4>
          <div className="text-muted">
            {staffLoading ? 'Loading...' : `Total: ${formatMoney(staffTotal)} · Entries: ${staffExpenses.length}`}
          </div>
        </div>
        <div className="row g-2 mb-3">
          <div className="col-md-4">
            <label className="form-label">Month</label>
            <input
              type="month"
              className="form-control"
              value={staffMonth}
              onChange={(event) => setStaffMonth(event.target.value)}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">Employee Name</label>
            <input
              type="text"
              className="form-control"
              placeholder="Search name"
              value={staffName}
              onChange={(event) => setStaffName(event.target.value)}
            />
          </div>
          <div className="col-md-4 d-flex align-items-end">
            <button className="btn btn-outline-primary w-100" type="button" onClick={loadStaffExpenses}>
              Apply Filters
            </button>
          </div>
        </div>
        <ExpenseTable expenses={staffExpenses} formatDate={formatDate} formatMoney={formatMoney} />
      </div>
    </div>
  );
};

export default Expenses;
