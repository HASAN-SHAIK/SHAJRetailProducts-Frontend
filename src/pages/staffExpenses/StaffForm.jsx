import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { usePopup } from '../../components/common/PopUp/PopupProvider';
import StaffExpensesHeader from '../../components/staffExpenses/StaffExpensesHeader';
import { getLocalStaff, getLocalStaffById, upsertLocalStaff } from '../../core/db';
import { collectValidationErrors, firstValidationMessage } from '../../utils/formValidation';
import './StaffExpenses.css';

const StaffForm = () => {
  const { staffId } = useParams();
  const navigate = useNavigate();
  const { showPopup } = usePopup();
  const isEdit = Boolean(staffId);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    role: '',
    salary: '',
    joinDate: '',
    status: 'active',
  });
  const [errors, setErrors] = useState({});

  const loadStaff = useCallback(async () => {
    if (!staffId) return;
    const staff = await getLocalStaffById(staffId);
    if (!staff) return;
    setForm({
      name: staff.name || '',
      phone: staff.phone || '',
      role: staff.role || '',
      salary: staff.salary ?? '',
      joinDate: staff.joinDate ? String(staff.joinDate).slice(0, 10) : '',
      status: staff.status || 'active',
    });
  }, [staffId]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const name = form.name.trim();
    const nextErrors = collectValidationErrors([
      { key: 'name', validate: () => Boolean(name), message: 'Name is required.' }
    ]);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      showPopup(firstValidationMessage(nextErrors), 'Validation');
      return;
    }
    const existing = await getLocalStaff({ search: name });
    const duplicate = existing.find(
      (item) =>
        item.staffId !== staffId &&
        String(item.name || '').toLowerCase() === name.toLowerCase() &&
        (!form.phone || String(item.phone || '') === String(form.phone || ''))
    );
    if (duplicate) {
      showPopup('Duplicate staff found', 'Validation');
      return;
    }

    const id = staffId || uuidv4();
    const payload = {
      staffId: id,
      name,
      phone: form.phone.trim(),
      role: form.role.trim(),
      salary: form.salary === '' ? null : Number(form.salary),
      joinDate: form.joinDate || null,
      status: form.status || 'active',
      isSynced: false,
      syncAction: isEdit ? 'UPDATE' : 'CREATE',
      updatedAt: new Date().toISOString(),
    };
    await upsertLocalStaff(payload);
    showPopup('Saved Successfully', 'Success');
    setErrors({});
    navigate('/staff-expenses/staff/list');
  };

  return (
    <div className="staff-expenses-page">
      <StaffExpensesHeader title={isEdit ? 'Edit Staff' : 'Add Staff'} />
      <div className="staff-expenses-card">
        <form className="staff-expenses-form" onSubmit={handleSubmit}>
          <div className="row g-2">
            <div className="col-md-4">
              <label className="form-label">Name *</label>
              <input className={`form-control ${errors.name ? 'is-invalid' : ''}`} name="name" value={form.name} onChange={handleChange} />
              {errors.name && <small className="text-danger">{errors.name}</small>}
            </div>
            <div className="col-md-4">
              <label className="form-label">Phone</label>
              <input className="form-control" name="phone" value={form.phone} onChange={handleChange} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Role</label>
              <input className="form-control" name="role" value={form.role} onChange={handleChange} />
            </div>
          </div>
          <div className="row g-2">
            <div className="col-md-4">
              <label className="form-label">Salary</label>
              <input
                type="number"
                className="form-control"
                name="salary"
                min="0"
                step="0.01"
                value={form.salary}
                onChange={handleChange}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Join Date</label>
              <input
                type="date"
                className="form-control"
                name="joinDate"
                value={form.joinDate}
                onChange={handleChange}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label">Status</label>
              <select className="form-select" name="status" value={form.status} onChange={handleChange}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="staff-expenses-actions">
            <button className="btn btn-primary" type="submit">
              {isEdit ? 'Update Staff' : 'Save Staff'}
            </button>
            <button className="btn btn-outline-light" type="button" onClick={() => navigate(-1)}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StaffForm;
