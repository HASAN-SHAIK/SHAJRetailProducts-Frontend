import React, { useState } from 'react';
import { reconcileSystem } from '../../services/accountingService';
import { usePopup } from '../../components/common/PopUp/PopupProvider';

const money = (value) => `INR ${Number(value || 0).toFixed(2)}`;

const ResultCard = ({ title, data, showBalance = false }) => {
  const isPass = String(data?.status || '').toUpperCase() === 'PASS';
  return (
    <div className="card mb-2">
      <div className="card-body py-2">
        <div className="d-flex justify-content-between align-items-center">
          <strong>{title}</strong>
          <span className={isPass ? 'text-success' : 'text-danger'}>
            {isPass ? 'PASS' : 'FAIL'}
          </span>
        </div>
        {!isPass && (
          <div className="small mt-1">
            <div>Expected: {money(data?.expected_value)}</div>
            <div>Actual: {money(data?.actual_value)}</div>
            <div>Difference: {money(data?.difference)}</div>
          </div>
        )}
        {isPass && showBalance && (
          <div className="small mt-1">Balance: {money(data?.balance)}</div>
        )}
      </div>
    </div>
  );
};

const BusinessSetup = () => {
  const { showPopup } = usePopup();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const runReconcile = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const payload = await reconcileSystem();
      setResult(payload);
    } catch (err) {
      showPopup(err?.response?.data?.message || err?.message || 'Failed to run reconciliation.', 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="billing-page accounts-page">
      <div className="customers-header">
        <h3>Business Setup</h3>
      </div>
      <button className="btn btn-primary mb-3" onClick={runReconcile} disabled={loading}>
        {loading ? 'Reconciling...' : 'Reconcile System'}
      </button>

      {result && (
        <div>
          <ResultCard title={result?.inventory?.status === 'PASS' ? 'Inventory matched' : `Inventory mismatch ${money(result?.inventory?.difference)}`} data={result?.inventory} />
          <ResultCard title={result?.supplier?.status === 'PASS' ? 'Supplier outstanding matched' : `Supplier mismatch ${money(result?.supplier?.difference)}`} data={result?.supplier} />
          <ResultCard title={result?.customer?.status === 'PASS' ? 'Customer outstanding matched' : `Customer mismatch ${money(result?.customer?.difference)}`} data={result?.customer} />
          <ResultCard title={result?.cash?.status === 'PASS' ? 'Cash correct' : `Cash mismatch ${money(result?.cash?.difference)}`} data={result?.cash} showBalance />
          <ResultCard title={result?.bank?.status === 'PASS' ? 'Bank correct' : `Bank mismatch ${money(result?.bank?.difference)}`} data={result?.bank} showBalance />
          <ResultCard title={result?.ledger_balance?.status === 'PASS' ? 'Double-entry balanced' : `Double-entry mismatch ${money(result?.ledger_balance?.difference)}`} data={result?.ledger_balance} />
        </div>
      )}
    </div>
  );
};

export default BusinessSetup;

