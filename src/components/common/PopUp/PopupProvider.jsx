import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import PopUp from './PopUp';

const PopupContext = createContext({
  showPopup: () => {},
  hidePopup: () => {},
});

export const PopupProvider = ({ children }) => {
  const [popup, setPopup] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  const showPopup = useCallback((message, title = 'Notice', type) => {
    const lowerTitle = (title || '').toLowerCase();
    const inferredType = type || (
      lowerTitle.includes('success')
        ? 'success'
        : lowerTitle.includes('error')
          ? 'error'
          : lowerTitle.includes('session')
            ? 'session'
            : lowerTitle.includes('validation')
              ? 'warning'
              : 'info'
    );
    const lowerMessage = (message || '').toString().toLowerCase();
    const isImportPopup = lowerTitle.includes('import') || lowerMessage.includes('import');
    const isErrorPopup = inferredType === 'error' || lowerTitle.includes('error');
    if (!isErrorPopup && !isImportPopup) {
      return;
    }
    setPopup({ isOpen: true, title, message, type: inferredType });
  }, []);

  const hidePopup = useCallback(() => {
    setPopup((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const value = useMemo(() => ({ showPopup, hidePopup }), [showPopup, hidePopup]);

  return (
    <PopupContext.Provider value={value}>
      {children}
      <PopUp
        title={popup.title}
        message={popup.message}
        type={popup.type}
        isOpen={popup.isOpen}
        onClose={hidePopup}
      />
    </PopupContext.Provider>
  );
};

export const usePopup = () => useContext(PopupContext);
