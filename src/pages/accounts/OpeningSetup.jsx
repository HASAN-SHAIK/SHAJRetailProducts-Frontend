import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/axios';
import { usePopup } from '../../components/common/PopUp/PopupProvider';
import { getSettings } from '../../services/settingsService';
import './Accounts.css';

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const OpeningSetup = () => {
  const navigate = useNavigate();
  const { showPopup } = usePopup();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const loadingRef = useRef(false);
  const [summary, setSummary] = useState({
    total_products: 0,
    total_quantity: 0,
    inventory_value: 0,
  });
  const [cashAmount, setCashAmount] = useState('');
  const [bankAmount, setBankAmount] = useState('');

  useEffect(() => {
    const load = async () => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      try {
        const settings = await getSettings();
        if (settings?.is_opening_completed === true) {
          navigate('/dashboard', { replace: true });
          return;
        }
        const res = await api.get('/accounts/opening-setup');
        const data = res?.data?.data || {};
        setSummary({
          total_products: toNumber(data.total_products),
          total_quantity: Number(toNumber(data.total_quantity).toFixed(2)),
          inventory_value: Number(toNumber(data.inventory_value).toFixed(2)),
        });
      } catch (err) {
        showPopup(err?.response?.data?.message || err?.message || 'Failed to load opening setup.', 'Error');
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    };
    load();
  }, [navigate]);

  const totalCapital = useMemo(() => {
    return Number((summary.inventory_value + toNumber(cashAmount) + toNumber(bankAmount)).toFixed(2));
  }, [summary.inventory_value, cashAmount, bankAmount]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        cash_amount: toNumber(cashAmount),
        bank_amount: toNumber(bankAmount),
      };
      await api.post('/accounts/opening-setup', payload);
      await api.post('/accounts/finalize-opening', payload);
      window.dispatchEvent(
        new CustomEvent('opening-setup-completed', {
          detail: { is_opening_completed: true },
        })
      );
      showPopup('Opening setup completed. Business is now active.', 'Success');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      showPopup(err?.response?.data?.message || err?.message || 'Failed to finalize opening.', 'Error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="billing-page accounts-page"><div className="billing-empty">Loading opening setup...</div></div>;
  }

  return (
    <div className="billing-page accounts-page">
      <h2 className="mb-3">Opening Setup</h2>
      <div className="billing-table-wrapper mb-3">
        <table className="billing-table">
          <tbody>
            <tr><th>Total Products</th><td>{summary.total_products}</td></tr>
            <tr><th>Total Quantity</th><td>{summary.total_quantity}</td></tr>
            <tr><th>Opening Stock Value</th><td>INR {summary.inventory_value.toFixed(2)}</td></tr>
          </tbody>
        </table>
      </div>

      <form className="accounts-form" onSubmit={handleSubmit}>
        <label>
          Cash in Hand
          <input className="form-control billing-input" type="number" min="0" step="0.01" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} />
        </label>
        <label>
          Bank Balance
          <input className="form-control billing-input" type="number" min="0" step="0.01" value={bankAmount} onChange={(e) => setBankAmount(e.target.value)} />
        </label>
        <p className="mt-2"><strong>Total Capital:</strong> INR {totalCapital.toFixed(2)}</p>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Starting Business...' : 'Confirm & Start Business'}
        </button>
      </form>
    </div>
  );
};

export default OpeningSetup;
