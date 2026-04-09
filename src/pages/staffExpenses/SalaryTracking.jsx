import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { usePopup } from '../../components/common/PopUp/PopupProvider';
import StaffExpensesHeader from '../../components/staffExpenses/StaffExpensesHeader';
import { getLocalSalaries, getLocalStaff, upsertLocalSalary } from '../../core/db';
import './StaffExpenses.css';

const defaultMonth = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
};

const SalaryTracking = () => {
  const { showPopup } = usePopup();
  const [staff, setStaff] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [filterMonth, setFilterMonth] = useState(defaultMonth());
  const [filterStaff, setFilterStaff] = useState('');
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

  const calculations = useMemo(() => {
    const base = Number(form.baseSalary || 0);
    const bonus = Number(form.bonus || 0);
    const deductions = Number(form.deductions || 0);
    const paid = Number(form.paidAmount || 0);
    const net = base + bonus - deductions;
    const pending = Math.max(net - paid, 0);
    let status = 'pending';
    if (paid <= 0) status = 'pending';
    else if (paid >= net) status = 'paid';
    else status = 'partial';
    return { net, pending, status };
  }, [form]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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
      deductions: Number(form.deductions || 0),
      netSalary: calculations.net,
      paidAmount: Number(form.paidAmount || 0),
      pendingAmount: calculations.pending,
      paymentStatus: calculations.status,
      isSynced: false,
      syncAction: 'CREATE',
      updatedAt: new Date().toISOString(),
    };
    await upsertLocalSalary(payload);
    showPopup('Saved Offline', 'Offline');
    setForm((prev) => ({ ...prev, baseSalary: '', bonus: '', deductions: '', paidAmount: '' }));
    loadSalaries();
  };

  return (
    <div className="staff-expenses-page">
      <StaffExpensesHeader title="Salary Tracking" />

      <div className="staff-expenses-card">
        <form className="staff-expenses-form" onSubmit={handleSubmit}>
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
              <label className="form-label">Deductions</label>
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

