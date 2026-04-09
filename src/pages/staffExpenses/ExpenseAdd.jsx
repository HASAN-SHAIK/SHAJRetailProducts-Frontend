import React, { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { usePopup } from '../../components/common/PopUp/PopupProvider';
import StaffExpensesHeader from '../../components/staffExpenses/StaffExpensesHeader';
import { getLocalStaff, upsertLocalExpense } from '../../core/db';
import './StaffExpenses.css';

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
    if (!form.category.trim()) {
      showPopup('Category is required', 'Validation');
      return;
    }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      showPopup('Amount must be > 0', 'Validation');
      return;
    }
    if (form.type === 'staff' && !form.staffId) {
      showPopup('Select staff for staff expense', 'Validation');
      return;
    }
    const payload = {
      expenseId: uuidv4(),
      type: form.type,
      category: form.category.trim(),
      amount,
      date: form.date || new Date().toISOString().slice(0, 10),
      staffId: form.type === 'staff' ? form.staffId : null,
      paymentMethod: form.paymentMethod,
      notes: form.notes.trim(),
      isSynced: false,
      syncAction: 'CREATE',
      updatedAt: new Date().toISOString(),
    };
    await upsertLocalExpense(payload);
    showPopup('Saved Offline', 'Offline');
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
              <input className="form-control" name="category" value={form.category} onChange={handleChange} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Amount *</label>
              <input
                type="number"
                className="form-control"
                name="amount"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={handleChange}
              />
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
              <select className="form-select" name="staffId" value={form.staffId} onChange={handleChange}>
                <option value="">Select staff</option>
                {staff.map((item) => (
                  <option key={item.staffId} value={item.staffId}>
                    {item.name}
                  </option>
                ))}
              </select>
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
