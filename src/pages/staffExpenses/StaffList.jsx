import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePopup } from '../../components/common/PopUp/PopupProvider';
import StaffExpensesHeader from '../../components/staffExpenses/StaffExpensesHeader';
import { getLocalStaff, upsertLocalStaff } from '../../core/db';
import './StaffExpenses.css';

const StaffList = () => {
  const navigate = useNavigate();
  const { showPopup } = usePopup();
  const [staff, setStaff] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const loadStaff = useCallback(async () => {
    const list = await getLocalStaff({ search, status });
    setStaff(list.filter((item) => !item.isDeleted));
  }, [search, status]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  useEffect(() => {
    const handler = () => loadStaff();
    window.addEventListener('staff-expenses-sync-updated', handler);
    return () => window.removeEventListener('staff-expenses-sync-updated', handler);
  }, [loadStaff]);

  const handleDelete = async (item) => {
    await upsertLocalStaff({
      ...item,
      isSynced: false,
      syncAction: 'DELETE',
      isDeleted: true,
      updatedAt: new Date().toISOString(),
    });
    showPopup('Saved Successfully', 'Success');
    loadStaff();
  };

  return (
    <div className="staff-expenses-page">
      <StaffExpensesHeader title="Staff List" />

      <div className="staff-expenses-card">
        <div className="staff-expenses-actions">
          <button className="btn btn-primary" type="button" onClick={() => navigate('/staff-expenses/staff/add')}>
            Add Staff
          </button>
          <div className="flex-grow-1" />
        </div>
      </div>

      <div className="staff-expenses-card">
        <div className="row g-2 mb-3">
          <div className="col-md-4">
            <label className="form-label">Search</label>
            <input
              className="form-control"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name or phone"
            />
          </div>
          <div className="col-md-3">
            <label className="form-label">Status</label>
            <select className="form-select" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <table className="staff-expenses-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Name</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Salary</th>
              <th>Join Date</th>
              <th>Active</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {staff.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-secondary">
                  No staff found.
                </td>
              </tr>
            )}
            {staff.map((item) => (
              <tr key={item.staffId}>
                <td>
                  <span className={`sync-dot ${item.isSynced ? 'synced' : ''}`}>
                    {item.isSynced ? 'Synced' : 'Not Synced'}
                  </span>
                </td>
                <td>{item.name}</td>
                <td>{item.phone || '-'}</td>
                <td>{item.role || '-'}</td>
                <td>{Number(item.salary || 0).toFixed(2)}</td>
                <td>{item.joinDate ? new Date(item.joinDate).toLocaleDateString('en-IN') : '-'}</td>
                <td className="text-capitalize">{item.status || 'active'}</td>
                <td className="text-end">
                  <div className="staff-expenses-actions">
                    <button
                      className="btn btn-outline-light btn-sm"
                      type="button"
                      onClick={() => navigate(`/staff-expenses/staff/edit/${item.staffId}`)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-outline-danger btn-sm"
                      type="button"
                      onClick={() => handleDelete(item)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StaffList;

