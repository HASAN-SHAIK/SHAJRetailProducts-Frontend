import React, { useState } from 'react';
import { sendCustomerReminder } from '../../services/customerReminderApi';
import { formatInr, toNumber } from '../../pages/customers/customerHelpers';

const PaymentReminderModal = ({ isOpen, onClose, customer, onReminderSent }) => {
  const [channel, setChannel] = useState('sms'); // 'sms' | 'whatsapp'
  const [phone, setPhone] = useState(customer?.phone || customer?.mobile || '');
  const [storeName, setStoreName] = useState('SHAJ Retail');
  const [upiId, setUpiId] = useState('shajretail@icici');
  const [customNote, setCustomNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);

  if (!isOpen || !customer) return null;

  const balance = toNumber(customer.outstanding ?? customer.current_balance ?? customer.credit_balance ?? 0);

  // Computed UPI Deep Link
  const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(storeName)}&am=${balance.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Khata-${customer.id}`)}`;

  // Default reminder text
  const messagePreview = customNote.trim()
    ? customNote
    : `Dear ${customer.name || 'Customer'}, friendly reminder from ${storeName}: Your outstanding Khata balance is ₹${balance.toFixed(2)}. Pay easily via UPI: ${upiLink}. Thank you!`;

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(upiLink);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  const handleSendReminder = async () => {
    if (!phone.trim()) {
      setStatusMessage({ type: 'danger', text: 'Please enter a valid recipient phone number.' });
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);
    try {
      const payload = {
        phone: phone.trim(),
        channel,
        storeName: storeName.trim(),
        upiId: upiId.trim(),
        customMessage: customNote.trim() || undefined,
        amount: balance,
      };

      const result = await sendCustomerReminder(customer.id, payload);
      setStatusMessage({
        type: 'success',
        text: `Payment reminder ${channel.toUpperCase()} successfully dispatched to ${phone}!`,
      });

      if (channel === 'whatsapp') {
        const cleanPhone = phone.replace(/\D/g, '');
        const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messagePreview)}`;
        window.open(waUrl, '_blank');
      }

      if (typeof onReminderSent === 'function') {
        onReminderSent(result?.reminder || result);
      }
    } catch (err) {
      setStatusMessage({
        type: 'danger',
        text: err?.response?.data?.message || err?.message || 'Failed to dispatch payment reminder.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal show d-block"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1060 }}
      role="dialog"
      aria-modal="true"
      data-testid="payment-reminder-modal"
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content shadow-lg border-0">
          {/* Header */}
          <div className="modal-header bg-primary text-white py-3">
            <h5 className="modal-title d-flex align-items-center gap-2">
              <span>📱 Send Khata Payment Reminder</span>
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              aria-label="Close"
              onClick={onClose}
              disabled={submitting}
            />
          </div>

          {/* Body */}
          <div className="modal-body p-3">
            {statusMessage && (
              <div
                className={`alert alert-${statusMessage.type} py-2 px-3 small d-flex justify-content-between align-items-center mb-3`}
                role="alert"
              >
                <span>{statusMessage.text}</span>
                <button
                  type="button"
                  className="btn-close btn-close-sm"
                  aria-label="Close"
                  onClick={() => setStatusMessage(null)}
                />
              </div>
            )}

            {/* Customer Summary Card */}
            <div className="card bg-light border p-3 mb-3">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <span className="text-muted small">Debtor Customer</span>
                <span className="badge bg-secondary font-monospace">#{customer.id}</span>
              </div>
              <h5 className="fw-bold mb-1">{customer.name || `Customer #${customer.id}`}</h5>
              <div className="d-flex justify-content-between align-items-baseline mt-2 pt-2 border-top">
                <span className="text-danger fw-semibold">Outstanding Balance:</span>
                <span className="h4 fw-bold text-danger mb-0">{formatInr(balance)}</span>
              </div>
            </div>

            {/* Delivery Channel */}
            <div className="mb-3">
              <label className="form-label small fw-bold mb-1">Delivery Channel</label>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className={`btn btn-sm flex-fill ${channel === 'sms' ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setChannel('sms')}
                  disabled={submitting}
                >
                  📩 Direct SMS
                </button>
                <button
                  type="button"
                  className={`btn btn-sm flex-fill ${channel === 'whatsapp' ? 'btn-success' : 'btn-outline-success'}`}
                  onClick={() => setChannel('whatsapp')}
                  disabled={submitting}
                >
                  💬 WhatsApp
                </button>
              </div>
            </div>

            {/* Recipient Phone */}
            <div className="mb-3">
              <label className="form-label small fw-bold mb-1" htmlFor="reminder-phone">
                Recipient Mobile Number
              </label>
              <input
                id="reminder-phone"
                className="form-control form-control-sm"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit phone number"
                disabled={submitting}
              />
            </div>

            {/* UPI Payment Configuration */}
            <div className="row g-2 mb-3">
              <div className="col-6">
                <label className="form-label small fw-bold mb-1" htmlFor="reminder-store-name">
                  Store Display Name
                </label>
                <input
                  id="reminder-store-name"
                  className="form-control form-control-sm"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="col-6">
                <label className="form-label small fw-bold mb-1" htmlFor="reminder-upi-id">
                  Receiving UPI ID (VPA)
                </label>
                <input
                  id="reminder-upi-id"
                  className="form-control form-control-sm"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            {/* UPI Deep Link Preview & Copy */}
            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label className="form-label small fw-bold mb-0">Generated UPI Deep Link</label>
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 text-decoration-none"
                  onClick={handleCopyLink}
                >
                  {copySuccess ? '✓ Copied!' : 'Copy UPI Link'}
                </button>
              </div>
              <input
                className="form-control form-control-sm bg-light font-monospace text-muted"
                value={upiLink}
                readOnly
              />
            </div>

            {/* Message Preview */}
            <div className="mb-2">
              <label className="form-label small fw-bold mb-1" htmlFor="reminder-preview">
                Message Content
              </label>
              <textarea
                id="reminder-preview"
                rows="3"
                className="form-control form-control-sm"
                value={messagePreview}
                onChange={(e) => setCustomNote(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer bg-light py-2">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`btn btn-sm px-4 fw-bold ${channel === 'whatsapp' ? 'btn-success' : 'btn-primary'}`}
              onClick={handleSendReminder}
              disabled={submitting || balance <= 0 || !phone.trim()}
            >
              {submitting
                ? 'Dispatching...'
                : channel === 'whatsapp'
                ? 'Send via WhatsApp'
                : 'Send SMS Reminder'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentReminderModal;
