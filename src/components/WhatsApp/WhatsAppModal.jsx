import React, { useEffect, useState } from 'react';

const normalizePhone = (value) => String(value || '').replace(/\D+/g, '');

const WhatsAppModal = ({ open, initialPhone, onClose, onSubmit, title }) => {
  const [phone, setPhone] = useState(initialPhone || '');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setPhone(initialPhone || '');
      setError('');
    }
  }, [open, initialPhone]);

  if (!open) return null;

  const handleSubmit = (event) => {
    event.preventDefault();
    const normalized = normalizePhone(phone);
    if (normalized.length !== 10) {
      setError('Phone must be 10 digits');
      return;
    }
    setError('');
    onSubmit(normalized);
  };

  return (
    <div className="delete-modal-overlay" onClick={onClose}>
      <div className="delete-modal" onClick={(event) => event.stopPropagation()}>
        <h4>{title || 'Enter Customer Mobile Number'}</h4>
        <form onSubmit={handleSubmit}>
          <div className="mb-2">
            <label className="form-label">Mobile Number</label>
            <input
              className="form-control"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="10 digit number"
              inputMode="numeric"
            />
          </div>
          {error && <div className="text-danger mb-2">{error}</div>}
          <div className="delete-actions">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-success">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WhatsAppModal;
