import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { addSyncQueueItem, createCustomer, getCustomerById, getCustomerDetail, replaceCustomerIdReferences, updateCustomer, upsertCustomersBulk } from '../../services/local';
import { syncAllCustomers } from '../../utils/customersSync';
import './Customers.css';

const defaultForm = {
  type: 'retail',
  name: '',
  phone: '',
  email: '',
  shop_name: '',
  gst_number: '',
  credit_limit: '',
  current_balance: '',
  address: '',
  location: '',
  notes: '',
  is_active: true,
};

const CustomerForm = () => {
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
    const resolveCustomerId = (value) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : value;
    };
    const applyCustomer = (customer) => {
      if (!customer) return;
      const resolvedAddress =
        customer.address ||
        [customer.address_line1, customer.address_line2].filter(Boolean).join(', ') ||
        '';
      const resolvedLocation = customer.location || customer.city || '';
      setForm((prev) => ({
        ...prev,
        ...customer,
        address: resolvedAddress,
        location: resolvedLocation,
        phone: customer.phone || customer.mobile || '',
      }));
    };
    (async () => {
      const cached = await getCustomerById(resolveCustomerId(id));
      if (cached) {
        applyCustomer(cached);
      }
      try {
        // Always try the configured repository. In local POS mode this remains the
        // on-device SQLite authority even without internet connectivity.
        const detail = await getCustomerDetail(resolveCustomerId(id));
        const customer = detail?.customer || null;
        if (customer) {
          applyCustomer(customer);
          upsertCustomersBulk([customer]).catch(() => {});
        } else if (!cached) {
          setError('Failed to load customer');
        }
      } catch {
        if (!cached) setError('Customer service is unavailable');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit]);

  const handleChange = (field) => (event) => {
    const value = field === 'is_active' ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      setError('Name and phone are required.');
      return;
    }
    if (form.type === 'wholesale' && !form.shop_name.trim()) {
      setError('Shop name is required for wholesale.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { credit_limit: _creditLimit, current_balance: _currentBalance, ...payload } = form;
      const nowIso = new Date().toISOString();
      const localId = isEdit ? id : `temp:${Date.now()}`;
      const localCustomer = {
        ...payload,
        credit_limit: form.credit_limit,
        current_balance: form.current_balance,
        id: localId,
        mobile: payload.phone || payload.mobile || '',
        updated_at: nowIso,
      };
      await upsertCustomersBulk([localCustomer]);

      let savedCustomer = null;
      let synced = false;

      try {
        // Do not use navigator.onLine as the authority boundary: LocalPosCustomerRepository
        // talks to the local POS runtime and must remain usable during internet outages.
        if (isEdit) {
          savedCustomer = await updateCustomer(id, payload);
        } else {
          savedCustomer = await createCustomer(payload);
        }
        synced = true;
      } catch {
        synced = false;
      }

      if (synced && savedCustomer) {
        if (!isEdit && savedCustomer?.id && String(savedCustomer.id) !== String(localId)) {
          await replaceCustomerIdReferences(localId, savedCustomer.id).catch(() => {});
        }
        upsertCustomersBulk([savedCustomer]).catch(() => {});
      } else {
        await addSyncQueueItem({
          type: 'customer',
          entityId: localId,
          action: isEdit ? 'update' : 'create',
          payload,
        });
        syncAllCustomers().catch(() => {});
      }

      navigate('/customers');
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  const formatFinancialSnapshot = (value) => {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number.toFixed(2) : '0.00';
  };

  return (
    <div className="billing-page customers-page">
      <div className="customers-header">
        <h3>{isEdit ? 'Edit Customer' : 'Add Customer'}</h3>
      </div>

      <div className="customer-card">
        {loading ? (
          <div className="billing-empty">Loading...</div>
        ) : (
          <form onSubmit={handleSubmit} className="customer-form-grid">
            <label className="billing-label">
              Type
              <select className="form-select form-select-sm" value={form.type} onChange={handleChange('type')}>
                <option value="retail">Retail</option>
                <option value="wholesale">Wholesale</option>
              </select>
            </label>
            <label className="billing-label">
              Name
              <input className="form-control form-control-sm billing-input" value={form.name} onChange={handleChange('name')} />
            </label>
            <label className="billing-label">
              Phone
              <input className="form-control form-control-sm billing-input" value={form.phone} onChange={handleChange('phone')} />
            </label>
            <label className="billing-label">
              Email
              <input className="form-control form-control-sm billing-input" value={form.email || ''} onChange={handleChange('email')} />
            </label>
            {form.type === 'wholesale' && (
              <>
                <label className="billing-label">
                  Shop Name
                  <input className="form-control form-control-sm billing-input" value={form.shop_name || ''} onChange={handleChange('shop_name')} />
                </label>
                <label className="billing-label">
                  GST Number
                  <input className="form-control form-control-sm billing-input" value={form.gst_number || ''} onChange={handleChange('gst_number')} />
                </label>
              </>
            )}
            <label className="billing-label">
              Credit Limit (Central)
              <input
                className="form-control form-control-sm billing-input"
                value={formatFinancialSnapshot(form.credit_limit)}
                readOnly
                aria-readonly="true"
              />
            </label>
            <label className="billing-label">
              Current Balance (Central)
              <input
                className="form-control form-control-sm billing-input"
                value={formatFinancialSnapshot(form.current_balance)}
                readOnly
                aria-readonly="true"
              />
            </label>
            <label className="billing-label">
              Address
              <input className="form-control form-control-sm billing-input" value={form.address || ''} onChange={handleChange('address')} />
            </label>
            <label className="billing-label">
              Location (City)
              <input className="form-control form-control-sm billing-input" value={form.location || ''} onChange={handleChange('location')} />
            </label>
            <label className="billing-label">
              Notes
              <textarea className="form-control form-control-sm billing-input" value={form.notes || ''} onChange={handleChange('notes')} />
            </label>
            <label className="billing-option-row" style={{ alignItems: 'center' }}>
              <input type="checkbox" checked={Boolean(form.is_active)} onChange={handleChange('is_active')} />
              Active
            </label>
            {error && <div className="billing-message">{error}</div>}
            <div>
              <button className="btn btn-success" type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Customer'}
              </button>
              <button className="btn btn-outline-light ms-2" type="button" onClick={() => navigate('/customers')}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CustomerForm;
