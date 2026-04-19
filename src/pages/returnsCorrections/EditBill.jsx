import React, { useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { usePopup } from '../../components/common/PopUp/PopupProvider';
import ReturnsHeader from '../../components/returnsCorrections/ReturnsHeader';
import { db, upsertLocalCorrection, upsertLocalGstEntry } from '../../core/db';
import './ReturnsCorrections.css';

const EditBill = () => {
  const { showPopup } = usePopup();
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState({
    billId: '',
    type: 'EDIT',
    changes: '',
    adjustedAmount: '',
    taxAdjustment: '',
  });

  const loadOrders = useCallback(async () => {
    const list = await db.orders.toArray();
    setOrders(list);
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.billId) {
      showPopup('Select a bill', 'Validation');
      return;
    }
    const correctionId = uuidv4();
    let changes = null;
    try {
      changes = form.changes ? JSON.parse(form.changes) : null;
    } catch {
      showPopup('Changes must be valid JSON', 'Validation');
      return;
    }
    const adjustedAmount = Number(form.adjustedAmount || 0);
    const taxAdjustment = Number(form.taxAdjustment || 0);
    const payload = {
      correctionId,
      billId: form.billId,
      type: form.type,
      changes,
      adjustedAmount,
      taxAdjustment,
      createdAt: new Date().toISOString(),
      isSynced: false,
      syncAction: 'CREATE',
    };
    await upsertLocalCorrection(payload);
    if (taxAdjustment !== 0) {
      await upsertLocalGstEntry({
        gstEntryId: uuidv4(),
        billId: form.billId,
        type: 'ADJUSTMENT',
        taxableAmount: adjustedAmount,
        cgst: taxAdjustment / 2,
        sgst: taxAdjustment / 2,
        igst: 0,
        totalTax: taxAdjustment,
        date: new Date().toISOString().slice(0, 10),
        isSynced: false,
        syncAction: 'CREATE',
        updatedAt: new Date().toISOString(),
      });
    }
    showPopup('Saved Offline', 'Offline');
    setForm((prev) => ({ ...prev, changes: '', adjustedAmount: '', taxAdjustment: '' }));
  };

  return (
    <div className="returns-page">
      <ReturnsHeader title="Edit Bill" />
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
              <label className="form-label">Type</label>
              <select className="form-select" name="type" value={form.type} onChange={handleChange}>
                <option value="EDIT">Edit</option>
                <option value="UPDATE">Update</option>
                <option value="CANCEL">Cancel</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Adjusted Amount</label>
              <input className="form-control" name="adjustedAmount" value={form.adjustedAmount} onChange={handleChange} />
            </div>
          </div>
          <div className="row g-2">
            <div className="col-md-4">
              <label className="form-label">Tax Adjustment</label>
              <input className="form-control" name="taxAdjustment" value={form.taxAdjustment} onChange={handleChange} />
            </div>
            <div className="col-md-8">
              <label className="form-label">Changes (JSON diff)</label>
              <textarea className="form-control" rows={3} name="changes" value={form.changes} onChange={handleChange} />
            </div>
          </div>
          <div className="returns-actions">
            <button className="btn btn-primary" type="submit">
              Save Correction
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditBill;
