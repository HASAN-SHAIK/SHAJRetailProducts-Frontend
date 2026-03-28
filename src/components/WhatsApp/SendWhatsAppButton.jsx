import React from 'react';

const SendWhatsAppButton = ({ onClick, disabled, loading, className, label }) => (
  <button
    type="button"
    className={className || 'btn btn-outline-success btn-sm'}
    onClick={onClick}
    disabled={disabled || loading}
  >
    {loading ? 'Sending...' : (label || 'Send via WhatsApp')}
  </button>
);

export default SendWhatsAppButton;
