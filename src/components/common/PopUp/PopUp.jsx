import React, { useEffect, useId, useRef } from 'react';
import './PopUp.css';

const PopUp = ({ title, message, onClose, isOpen, type = 'info' }) => {
  const closeButtonRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    if (!isOpen) return undefined;

    previouslyFocusedRef.current = document.activeElement;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      const previous = previouslyFocusedRef.current;
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) {
        previous.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div
        className={`modal-container popup-bounce popup-${type}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
      >
        {type === 'success' && (
          <div className="confetti" aria-hidden="true">
            {Array.from({ length: 18 }).map((_, i) => (
              <span className="confetti-piece" key={i} />
            ))}
          </div>
        )}
        <div className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="close-button"
            onClick={onClose}
            aria-label="Close notification"
          >
            &times;
          </button>
        </div>
        <div className="modal-body">
          <p id={messageId}>{message}</p>
        </div>
      </div>
    </div>
  );
};

export default PopUp;
