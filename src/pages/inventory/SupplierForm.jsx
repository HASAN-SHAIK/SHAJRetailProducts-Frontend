import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../utils/axios';
import { getSupplierCacheById } from '../../core/db';
import { createOfflineSupplier, updateOfflineSupplier } from '../../utils/offlineSuppliers';
import './Suppliers.css';

const defaultForm = {
  name: '',
  mobile: '',
  email: '',
  gst_number: '',
  credit_limit: '',
  address: '',
  is_active: true,
};

const SupplierForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    const load = async () => {
      try {
        if (!navigator.onLine) throw new Error('offline');
        const res = await api.get(`/suppliers/${id}`);
        const supplier = res?.data?.data?.supplier || res?.data?.supplier;
        if (supplier) {
          setForm((prev) => ({
            ...prev,
            ...supplier,
            mobile: supplier.mobile || '',
          }));
          return;
        }
      } catch {
        const cached = await getSupplierCacheById(id);
        if (cached) {
          setForm((prev) => ({
            ...prev,
            ...cached,
            mobile: cached.mobile || '',
          }));
          return;
        }
        setError('Failed to load supplier');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, isEdit]);

  const handleChange = (field) => (event) => {
    const value = field === 'is_active' ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = { ...form };
      if (isEdit) {
        await updateOfflineSupplier({ ...payload, id });
      } else {
        await createOfflineSupplier(payload);
      }
      navigate('/inventory/suppliers');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save supplier');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="billing-page suppliers-page">
        <div className="billing-empty">Loading...</div>
      </div>
    );
  }

  return (
    <div className="billing-page suppliers-page">
      <div className="customers-header">
        <h3>{isEdit ? 'Edit Supplier' : 'New Supplier'}</h3>
        <button className="btn btn-outline-light" onClick={() => navigate('/inventory/suppliers')}>
          Back
        </button>
      </div>
      {error && <div className="billing-error">{error}</div>}
      <form className="customer-form" onSubmit={handleSubmit}>
        <div className="customer-form-grid">
          <label>
            Supplier Name *
            <input className="form-control billing-input" value={form.name} onChange={handleChange('name')} />
          </label>
          <label>
            Mobile
            <input className="form-control billing-input" value={form.mobile} onChange={handleChange('mobile')} />
          </label>
          <label>
            Email
            <input className="form-control billing-input" value={form.email} onChange={handleChange('email')} />
          </label>
          <label>
            GST Number
            <input className="form-control billing-input" value={form.gst_number} onChange={handleChange('gst_number')} />
          </label>
          <label>
            Credit Limit
            <input
              className="form-control billing-input"
              type="number"
              min="0"
              value={form.credit_limit}
              onChange={handleChange('credit_limit')}
            />
          </label>
          <label>
            Address
            <input className="form-control billing-input" value={form.address} onChange={handleChange('address')} />
          </label>
          <label className="checkbox-field">
            <input type="checkbox" checked={form.is_active} onChange={handleChange('is_active')} />
            Active
          </label>
        </div>
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save Supplier'}
        </button>
      </form>
    </div>
  );
};

export default SupplierForm;
