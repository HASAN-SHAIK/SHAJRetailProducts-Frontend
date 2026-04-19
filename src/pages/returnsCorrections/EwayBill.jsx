import React, { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { usePopup } from '../../components/common/PopUp/PopupProvider';
import ReturnsHeader from '../../components/returnsCorrections/ReturnsHeader';
import { db, getLocalEwayBills, upsertLocalEwayBill } from '../../core/db';
import './ReturnsCorrections.css';

const EwayBill = () => {
  const { showPopup } = usePopup();
  const [orders, setOrders] = useState([]);
  const [ewayBills, setEwayBills] = useState([]);
  const [form, setForm] = useState({
    billId: '',
    transportDetails: '',
    distance: '',
    gstin: '',
    generatedNumber: '',
    status: 'pending',
  });

  const loadOrders = useCallback(async () => {
    const list = await db.orders.toArray();
    setOrders(list);
  }, []);

  const loadEways = useCallback(async () => {
    const list = await getLocalEwayBills();
    setEwayBills(list);
  }, []);

  useEffect(() => {
    loadOrders();
    loadEways();
  }, [loadOrders, loadEways]);

  useEffect(() => {
    const handler = () => loadEways();
    window.addEventListener('returns-corrections-sync-updated', handler);
    return () => window.removeEventListener('returns-corrections-sync-updated', handler);
  }, [loadEways]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.billId) {
      showPopup('Select bill', 'Validation');
      return;
    }
    const payload = {
      ewayId: uuidv4(),
      billId: form.billId,
      transportDetails: form.transportDetails,
      distance: form.distance,
      gstin: form.gstin,
      generatedNumber: form.generatedNumber,
      status: form.status,
      isSynced: false,
      syncAction: 'CREATE',
      updatedAt: new Date().toISOString(),
    };
    await upsertLocalEwayBill(payload);
    showPopup('Saved Offline', 'Offline');
    setForm((prev) => ({
      ...prev,
      transportDetails: '',
      distance: '',
      gstin: '',
      generatedNumber: '',
    }));
    loadEways();
  };

  return (
    <div className="returns-page">
      <ReturnsHeader title="E-Way Bill" />
      <div className="returns-card">
        <form className="returns-form" onSubmit={handleSubmit}>
          <div className="row g-2">
            <div className="col-md-4">
              <label className="form-label">Bill</label>
              <select className="form-select" name="billId" value={form.billId} onChange={handleChange}>
                <option value="">Select bill</option>
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    Bill #{order.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">GSTIN</label>
              <input className="form-control" name="gstin" value={form.gstin} onChange={handleChange} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Distance (km)</label>
              <input className="form-control" name="distance" value={form.distance} onChange={handleChange} />
            </div>
          </div>
          <div className="row g-2">
            <div className="col-md-6">
              <label className="form-label">Transport Details</label>
              <input className="form-control" name="transportDetails" value={form.transportDetails} onChange={handleChange} />
            </div>
            <div className="col-md-3">
              <label className="form-label">E-way Number</label>
              <input className="form-control" name="generatedNumber" value={form.generatedNumber} onChange={handleChange} />
            </div>
            <div className="col-md-3">
              <label className="form-label">Status</label>
              <select className="form-select" name="status" value={form.status} onChange={handleChange}>
                <option value="pending">Pending</option>
                <option value="generated">Generated</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <div className="returns-actions">
            <button className="btn btn-primary" type="submit">
              Save E-way
            </button>
          </div>
        </form>
      </div>

      <div className="returns-card">
        <table className="returns-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Bill</th>
              <th>GSTIN</th>
              <th>Distance</th>
              <th>E-way No</th>
            </tr>
          </thead>
          <tbody>
            {ewayBills.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-secondary">
                  No e-way bills.
                </td>
              </tr>
            )}
            {ewayBills.map((row) => (
              <tr key={row.ewayId}>
                <td>{row.status}</td>
                <td>{row.billId}</td>
                <td>{row.gstin || '-'}</td>
                <td>{row.distance || '-'}</td>
                <td>{row.generatedNumber || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EwayBill;

