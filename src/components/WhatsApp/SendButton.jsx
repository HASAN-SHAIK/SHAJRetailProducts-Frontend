import React from 'react';

const SendButton = ({ disabled, onClick }) => (
  <button className="btn btn-outline-success" type="button" onClick={onClick} disabled={disabled}>
    Send via WhatsApp
  </button>
);

export default SendButton;
