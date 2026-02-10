import React from 'react';
import './PopUp.css';

const PopUp = ({ title, message, onClose, isOpen, type = 'info' }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className={`modal-container popup-bounce popup-${type}`}>
        {type === 'success' && (
          <div className="confetti" aria-hidden="true">
            {Array.from({ length: 18 }).map((_, i) => (
              <span className="confetti-piece" key={i} />
            ))}
          </div>
        )}
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="close-button" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          <p>{message}</p>
        </div>
        {/* <div className="modal-footer">
          <button className="modal-button" onClick={onClose}>
            Close
          </button>
        </div> */}
      </div>
    </div>
  );
};

export default PopUp;
