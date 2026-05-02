import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { usePopup } from '../../components/common/PopUp/PopupProvider';
import StaffExpensesHeader from '../../components/staffExpenses/StaffExpensesHeader';
import {
  getConfigValue,
  getLocalExpenses,
  getLocalSalaries,
  getLocalStaff,
  saveConfigValue,
  upsertLocalSalary
} from '../../core/db';
import './StaffExpenses.css';

const SALARY_DEDUCT_TOGGLE_KEY = 'staff_salary_auto_deduct_expenses';

const defaultMonth = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
};

const getMonthRange = (monthValue) => {
  const safe = String(monthValue || '');
  const [yearText, monthText] = safe.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
};

const SalaryTracking = () => {
  const { showPopup } = usePopup();
  const [staff, setStaff] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [filterMonth, setFilterMonth] = useState(defaultMonth());
  const [filterStaff, setFilterStaff] = useState('');
  const [autoDeductStaffExpenses, setAutoDeductStaffExpenses] = useState(false);
  const [linkedStaffExpenseTotal, setLinkedStaffExpenseTotal] = useState(0);
  const [form, setForm] = useState({
    staffId: '',
    month: defaultMonth(),
    baseSalary: '',
    bonus: '',
    deductions: '',
    paidAmount: '',
  });

  const loadStaff = useCallback(async () => {
    const list = await getLocalStaff({});
    setStaff(list.filter((item) => !item.isDeleted));
  }, []);

  const loadSalaries = useCallback(async () => {
    const list = await getLocalSalaries({ staffId: filterStaff || undefined, month: filterMonth || undefined });
    setSalaries(list.filter((item) => !item.isDeleted));
  }, [filterStaff, filterMonth]);

  useEffect(() => {
    loadStaff();
    loadSalaries();
  }, [loadStaff, loadSalaries]);

  useEffect(() => {
    const handler = () => loadSalaries();
    window.addEventListener('staff-expenses-sync-updated', handler);
    return () => window.removeEventListener('staff-expenses-sync-updated', handler);
  }, [loadSalaries]);

  useEffect(() => {
    let mounted = true;
    const loadToggle = async () => {
      const stored = await getConfigValue(SALARY_DEDUCT_TOGGLE_KEY);
      if (!mounted) return;
      setAutoDeductStaffExpenses(stored === true);
    };
    loadToggle();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadLinkedExpenses = async () => {
      if (!form.staffId || !form.month) {
        setLinkedStaffExpenseTotal(0);
        return;
      }
      const range = getMonthRange(form.month);
      if (!range) {
        setLinkedStaffExpenseTotal(0);
        return;
      }
      const list = await getLocalExpenses({
        type: 'staff',
        staffId: form.staffId,
        from: range.from,
        to: range.to
      });
      if (cancelled) return;
      const total = (Array.isArray(list) ? list : [])
        .filter((item) => !item?.isDeleted)
        .reduce((sum, item) => sum + Number(item?.amount || 0), 0);
      setLinkedStaffExpenseTotal(total);
    };
    loadLinkedExpenses();
    return () => {
      cancelled = true;
    };
  }, [form.staffId, form.month]);

  useEffect(() => {
    if (!form.staffId) return;
    const selectedStaff = staff.find((item) => String(item.staffId) === String(form.staffId));
    if (!selectedStaff) return;
    const staffSalary = Number(selectedStaff.salary ?? 0);
    setForm((prev) => ({
      ...prev,
      baseSalary: Number.isFinite(staffSalary) ? String(staffSalary) : prev.baseSalary,
    }));
  }, [form.staffId, staff]);

  const calculations = useMemo(() => {
    const base = Number(form.baseSalary || 0);
    const bonus = Number(form.bonus || 0);
    const deductions = Number(form.deductions || 0);
    const staffExpenseDeduction = autoDeductStaffExpenses ? Number(linkedStaffExpenseTotal || 0) : 0;
    const totalDeductions = deductions + staffExpenseDeduction;
    const paid = Number(form.paidAmount || 0);
    const net = base + bonus - totalDeductions;
    const pending = Math.max(net - paid, 0);
    let status = 'pending';
    if (paid <= 0) status = 'pending';
    else if (paid >= net) status = 'paid';
    else status = 'partial';
    return { net, pending, status, staffExpenseDeduction, totalDeductions };
  }, [form, autoDeductStaffExpenses, linkedStaffExpenseTotal]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleToggleAutoDeduction = async (event) => {
    const checked = Boolean(event.target.checked);
    setAutoDeductStaffExpenses(checked);
    await saveConfigValue(SALARY_DEDUCT_TOGGLE_KEY, checked);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.staffId) {
      showPopup('Select staff member', 'Validation');
      return;
    }
    if (!form.month) {
      showPopup('Select month', 'Validation');
      return;
    }
    const payload = {
      salaryId: uuidv4(),
      staffId: form.staffId,
      month: form.month,
      baseSalary: Number(form.baseSalary || 0),
      bonus: Number(form.bonus || 0),
      deductions: calculations.totalDeductions,
      manualDeductions: Number(form.deductions || 0),
      autoDeductStaffExpenses,
      staffExpenseDeduction: calculations.staffExpenseDeduction,
      totalDeductions: calculations.totalDeductions,
      netSalary: calculations.net,
      paidAmount: Number(form.paidAmount || 0),
      pendingAmount: calculations.pending,
      paymentStatus: calculations.status,
      isSynced: false,
      syncAction: 'CREATE',
      updatedAt: new Date().toISOString(),
    };
    await upsertLocalSalary(payload);
    showPopup('Saved Successfully', 'Success');
    setForm((prev) => ({ ...prev, baseSalary: '', bonus: '', deductions: '', paidAmount: '' }));
    loadSalaries();
  };

  return (
    <div className="staff-expenses-page">
      <StaffExpensesHeader title="Salary Tracking" />

      <div className="staff-expenses-card">
        <form className="staff-expenses-form" onSubmit={handleSubmit}>
          <div className="staff-expenses-actions mb-2">
            <label className="form-check-label d-inline-flex align-items-center gap-2">
              <input
                type="checkbox"
                className="form-check-input mt-0"
                checked={autoDeductStaffExpenses}
                onChange={handleToggleAutoDeduction}
              />
              Auto-deduct staff expenses from salary
            </label>
          </div>
          <div className="row g-2">
            <div className="col-md-4">
              <label className="form-label">Staff *</label>
              <select className="form-select" name="staffId" value={form.staffId} onChange={handleChange}>
                <option value="">Select staff</option>
                {staff.map((item) => (
                  <option key={item.staffId} value={item.staffId}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Month *</label>
              <input type="month" className="form-control" name="month" value={form.month} onChange={handleChange} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Base Salary</label>
              <input
                type="number"
                className="form-control"
                name="baseSalary"
                value={form.baseSalary}
                onChange={handleChange}
              />
            </div>
          </div>
          <div className="row g-2">
            <div className="col-md-4">
              <label className="form-label">Bonus</label>
              <input type="number" className="form-control" name="bonus" value={form.bonus} onChange={handleChange} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Deductions (Manual)</label>
              <input
                type="number"
                className="form-control"
                name="deductions"
                value={form.deductions}
                onChange={handleChange}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Paid Amount</label>
              <input
                type="number"
                className="form-control"
                name="paidAmount"
                value={form.paidAmount}
                onChange={handleChange}
              />
            </div>
          </div>
          <div className="staff-expenses-actions">
            <span className="pill-badge">
              Net: {calculations.net.toFixed(2)} | Pending: {calculations.pending.toFixed(2)} | {calculations.status}
            </span>
            {autoDeductStaffExpenses && (
              <span className="pill-badge">
                Staff Expenses Deduction: {Number(linkedStaffExpenseTotal || 0).toFixed(2)} | Total Deductions: {Number(calculations.totalDeductions || 0).toFixed(2)}
              </span>
            )}
            <button className="btn btn-primary" type="submit">
              Save Salary
            </button>
          </div>
        </form>
      </div>

      <div className="staff-expenses-card">
        <div className="row g-2 mb-3">
          <div className="col-md-4">
            <label className="form-label">Filter Month</label>
            <input
              type="month"
              className="form-control"
              value={filterMonth}
              onChange={(event) => setFilterMonth(event.target.value)}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label">Filter Staff</label>
            <select className="form-select" value={filterStaff} onChange={(event) => setFilterStaff(event.target.value)}>
              <option value="">All</option>
              {staff.map((item) => (
                <option key={item.staffId} value={item.staffId}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <table className="staff-expenses-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Staff</th>
              <th>Month</th>
              <th>Net</th>
              <th>Paid</th>
              <th>Pending</th>
              <th>Payment Status</th>
            </tr>
          </thead>
          <tbody>
            {salaries.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-secondary">
                  No salary entries.
                </td>
              </tr>
            )}
            {salaries.map((item) => {
              const staffName = staff.find((s) => s.staffId === item.staffId)?.name || '-';
              return (
                <tr key={item.salaryId}>
                  <td>
                    <span className={`sync-dot ${item.isSynced ? 'synced' : ''}`}>
                      {item.isSynced ? 'Synced' : 'Not Synced'}
                    </span>
                  </td>
                  <td>{staffName}</td>
                  <td>{item.month}</td>
                  <td>{Number(item.netSalary || 0).toFixed(2)}</td>
                  <td>{Number(item.paidAmount || 0).toFixed(2)}</td>
                  <td>{Number(item.pendingAmount || 0).toFixed(2)}</td>
                  <td className="text-capitalize">{item.paymentStatus}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SalaryTracking;
