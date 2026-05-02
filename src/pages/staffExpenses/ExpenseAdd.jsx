import React, { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { usePopup } from '../../components/common/PopUp/PopupProvider';
import StaffExpensesHeader from '../../components/staffExpenses/StaffExpensesHeader';
import { getLocalStaff, upsertLocalExpense } from '../../core/db';
import { collectValidationErrors, firstValidationMessage } from '../../utils/formValidation';
import './StaffExpenses.css';

const getLocalDateValue = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const ExpenseAdd = () => {
  const { showPopup } = usePopup();
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState({
    type: 'shop',
    category: '',
    amount: '',
    date: '',
    staffId: '',
    paymentMethod: 'cash',
    notes: '',
  });
  const [errors, setErrors] = useState({});

  const loadStaff = useCallback(async () => {
    const list = await getLocalStaff({});
    setStaff(list.filter((item) => !item.isDeleted));
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const amount = Number(form.amount);
    const nextErrors = collectValidationErrors([
      { key: 'category', validate: () => Boolean(form.category.trim()), message: 'Category is required.' },
      { key: 'amount', validate: () => Number.isFinite(amount) && amount > 0, message: 'Amount must be greater than 0.' },
      { key: 'staffId', validate: () => form.type !== 'staff' || Boolean(form.staffId), message: 'Select staff for staff expense.' }
    ]);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      showPopup(firstValidationMessage(nextErrors), 'Validation');
      return;
    }
    const payload = {
      expenseId: uuidv4(),
      type: form.type,
      category: form.category.trim(),
      amount,
      date: form.date || getLocalDateValue(),
      staffId: form.type === 'staff' ? form.staffId : null,
      paymentMethod: form.paymentMethod,
      notes: form.notes.trim(),
      isSynced: false,
      syncAction: 'CREATE',
      updatedAt: new Date().toISOString(),
    };
    await upsertLocalExpense(payload);
    window.dispatchEvent(new CustomEvent('staff-expenses-sync-updated'));
    showPopup('Saved Successfully', 'Success');
    setErrors({});
    setForm((prev) => ({
      ...prev,
      category: '',
      amount: '',
      date: '',
      staffId: '',
      notes: '',
    }));
  };

  return (
    <div className="staff-expenses-page">
      <StaffExpensesHeader title="Add Expense" />
      <div className="staff-expenses-card">
        <form className="staff-expenses-form" onSubmit={handleSubmit}>
          <div className="row g-2">
            <div className="col-md-4">
              <label className="form-label">Type</label>
              <select className="form-select" name="type" value={form.type} onChange={handleChange}>
                <option value="shop">Shop</option>
                <option value="staff">Staff</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Category *</label>
              <input className={`form-control ${errors.category ? 'is-invalid' : ''}`} name="category" value={form.category} onChange={handleChange} />
              {errors.category && <small className="text-danger">{errors.category}</small>}
            </div>
            <div className="col-md-4">
              <label className="form-label">Amount *</label>
              <input
                type="number"
                className={`form-control ${errors.amount ? 'is-invalid' : ''}`}
                name="amount"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={handleChange}
              />
              {errors.amount && <small className="text-danger">{errors.amount}</small>}
            </div>
          </div>
          <div className="row g-2">
            <div className="col-md-4">
              <label className="form-label">Date</label>
              <input type="date" className="form-control" name="date" value={form.date} onChange={handleChange} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Payment Method</label>
              <select className="form-select" name="paymentMethod" value={form.paymentMethod} onChange={handleChange}>
                <option value="cash">Cash</option>
                <option value="online">Online</option>
                <option value="bank">Bank</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Staff</label>
              <select className={`form-select ${errors.staffId ? 'is-invalid' : ''}`} name="staffId" value={form.staffId} onChange={handleChange}>
                <option value="">Select staff</option>
                {staff.map((item) => (
                  <option key={item.staffId} value={item.staffId}>
                    {item.name}
                  </option>
                ))}
              </select>
              {errors.staffId && <small className="text-danger">{errors.staffId}</small>}
            </div>
          </div>
          <div className="row g-2">
            <div className="col-md-12">
              <label className="form-label">Notes</label>
              <textarea className="form-control" name="notes" rows={2} value={form.notes} onChange={handleChange} />
            </div>
          </div>
          <div className="staff-expenses-actions">
            <button className="btn btn-primary" type="submit">
              Save Expense
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExpenseAdd;
