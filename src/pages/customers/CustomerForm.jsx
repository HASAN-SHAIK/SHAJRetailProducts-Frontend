import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createCustomer, getCustomerById, searchCustomers, updateCustomer } from '../../services/local';
import { isLocalPosEnabled } from '../../Repositories/local/posLocalApiClient';
import { getDuplicateCustomerFromError, isDuplicateCustomerError } from '../../Repositories/api/customerNormalizer';
import {
  CUSTOMER_TYPES,
  EMPTY_CUSTOMER_FORM,
  buildCustomerSubmitPayload,
  customerToForm,
  findCustomerByPhone,
  formatInr,
  getAvailableCredit,
  normalizePhoneDigits,
  validateCustomerForm,
} from './customerHelpers';
import './Customers.css';

const CustomerForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const localMode = isLocalPosEnabled();
  const [form, setForm] = useState({ ...EMPTY_CUSTOMER_FORM });
  const [existing, setExisting] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [duplicate, setDuplicate] = useState(null);
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && !navigator.onLine);
  const submittingRef = useRef(false);

  // Against the central API, writes need a connection. The local POS service
  // accepts writes while the store is offline.
  const requiresConnection = !localMode && offline;
  // The local POS service only stores identity/contact fields.
  const limitedFields = localMode;

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    if (!isEdit) return undefined;
    let active = true;
    setLoading(true);
    getCustomerById(id)
      .then((customer) => {
        if (!active) return;
        if (!customer) {
          setError('Customer not found.');
          return;
        }
        setExisting(customer);
        setForm(customerToForm(customer));
      })
      .catch(() => {
        if (active) setError('Could not load this customer. Check the connection and try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, isEdit]);

  const handleChange = (field) => (event) => {
    const value = field === 'is_active' ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submittingRef.current || requiresConnection) return;

    const validation = validateCustomerForm(form);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    submittingRef.current = true;
    setSaving(true);
    setError('');
    setDuplicate(null);
    try {
      const payload = buildCustomerSubmitPayload(form, { isEdit });

      // Fast pre-check for a friendlier message. The central API is the real
      // guard: it answers 409 DUPLICATE_CUSTOMER (handled below) and never
      // merges into another customer's record.
      const matches = await searchCustomers({ search: normalizePhoneDigits(form.phone), limit: 20 });
      const match = findCustomerByPhone(matches, form.phone, isEdit ? id : null);
      if (match) {
        setErrors({ phone: `Mobile number already belongs to ${match.name || 'another customer'}.` });
        setDuplicate(match);
        return;
      }

      const saved = isEdit ? await updateCustomer(id, payload) : await createCustomer(payload);
      navigate(saved?.id ? `/customers/${saved.id}` : '/customers');
    } catch (err) {
      if (isDuplicateCustomerError(err)) {
        const existingCustomer = getDuplicateCustomerFromError(err);
        setErrors({
          phone: `Mobile number already belongs to ${existingCustomer?.name || 'another customer'}.`,
        });
        setDuplicate(existingCustomer || { id: null });
        return;
      }
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to save customer.'
      );
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="billing-page customers-page">
        <div className="billing-empty">Loading customer...</div>
      </div>
    );
  }

  const fieldError = (field) =>
    errors[field] ? <div className="text-danger small" role="alert">{errors[field]}</div> : null;
  const available = existing ? getAvailableCredit(existing) : null;

  return (
    <div className="billing-page customers-page">
      <div className="customers-header">
        <h3>{isEdit ? 'Edit Customer' : 'New Customer'}</h3>
        <button type="button" className="btn btn-outline-light" onClick={() => navigate(isEdit ? `/customers/${id}` : '/customers')}>
          Back
        </button>
      </div>

      {requiresConnection && (
        <div className="billing-error" role="status">
          You are offline. Customer changes need a connection. You can still add a customer while billing.
        </div>
      )}
      {limitedFields && (
        <div className="text-muted small">
          Shop, type, address, location, notes and status are not stored by the local POS service and are disabled here.
        </div>
      )}
      {error && <div className="billing-error" role="alert">{error}</div>}
      {duplicate && duplicate.id && (
        <div className="billing-error" role="alert" data-testid="duplicate-customer">
          A customer with this mobile number already exists ({duplicate.name || 'unnamed'}). Nothing was changed.{' '}
          <button type="button" className="btn btn-link p-0 align-baseline" onClick={() => navigate(`/customers/${duplicate.id}`)}>
            Open existing customer
          </button>
        </div>
      )}

      <form className="customer-form" onSubmit={handleSubmit} noValidate>
        <div className="customer-form-grid">
          <label>
            Customer Name *
            <input className="form-control billing-input" value={form.name} onChange={handleChange('name')} maxLength={120} />
            {fieldError('name')}
          </label>
          <label>
            Mobile *
            <input className="form-control billing-input" value={form.phone} onChange={handleChange('phone')} inputMode="tel" />
            {fieldError('phone')}
          </label>
          <label>
            Email
            <input className="form-control billing-input" type="email" value={form.email} onChange={handleChange('email')} />
            {fieldError('email')}
          </label>
          <label>
            GSTIN
            <input className="form-control billing-input" value={form.gst_number} onChange={handleChange('gst_number')} maxLength={15} />
            {fieldError('gst_number')}
          </label>
          <label>
            Shop Name
            <input className="form-control billing-input" value={form.shop_name} onChange={handleChange('shop_name')} disabled={limitedFields} />
          </label>
          <label>
            Type
            <select className="form-control billing-input" value={form.type} onChange={handleChange('type')} disabled={limitedFields}>
              {CUSTOMER_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            {fieldError('type')}
          </label>
          <label>
            Location
            <input className="form-control billing-input" value={form.location} onChange={handleChange('location')} disabled={limitedFields} />
          </label>
          <label>
            Address
            <input className="form-control billing-input" value={form.address} onChange={handleChange('address')} disabled={limitedFields} />
          </label>
          <label>
            Notes
            <input className="form-control billing-input" value={form.notes} onChange={handleChange('notes')} disabled={limitedFields} />
          </label>
          <label className="checkbox-field">
            <input type="checkbox" checked={form.is_active} onChange={handleChange('is_active')} disabled={limitedFields} />
            Active
          </label>
        </div>

        {isEdit && existing && (
          <div className="customer-card mt-3">
            <div className="text-muted small mb-1">Read-only. Managed through billing and accounting.</div>
            <div className="customer-detail-grid">
              <div><strong>Outstanding balance:</strong> {formatInr(existing.current_balance)}</div>
              <div><strong>Credit limit:</strong> {formatInr(existing.credit_limit)}</div>
              <div><strong>Available credit:</strong> {available === null ? 'No credit limit set' : formatInr(available)}</div>
            </div>
          </div>
        )}

        <button className="btn btn-primary mt-3" type="submit" disabled={saving || requiresConnection}>
          {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Customer'}
        </button>
      </form>
    </div>
  );
};

export default CustomerForm;
