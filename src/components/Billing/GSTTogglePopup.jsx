import React from 'react';
import { isLocalPosEnabled } from '../../Repositories/local/posLocalApiClient';

const GSTTogglePopup = ({ isOpen, isGSTEnabled, onToggle, onClose }) => {
  if (!isOpen) return null;

  const localPosAuthoritative = isLocalPosEnabled();

  return (
    <div className="gst-popup-overlay" onClick={onClose}>
      <div className="gst-popup" onClick={(event) => event.stopPropagation()}>
        <div className="gst-popup-header">
          <h5>{localPosAuthoritative ? 'GST Policy' : 'GST Override'}</h5>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
        </div>
        <div className="gst-popup-body">
          {localPosAuthoritative ? (
            <p role="status" className="mb-0">
              GST is calculated by the local POS from Central policy and cannot be overridden here.
            </p>
          ) : (
            <label className="form-check-label gst-toggle">
              <input
                className="form-check-input"
                type="checkbox"
                checked={isGSTEnabled}
                onChange={(event) => onToggle(event.target.checked)}
              />
              Enable GST
            </label>
          )}
        </div>
      </div>
    </div>
  );
};

export default GSTTogglePopup;
