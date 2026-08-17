import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import PopUp from './PopUp';

const PopupContext = createContext({
  showPopup: () => {},
  hidePopup: () => {},
});

const POS_POLICY_MESSAGES = {
  price_override_not_allowed: {
    title: 'Price policy',
    message: 'Manual price override is not allowed by the current store policy.',
    type: 'warning',
  },
  discount_not_allowed: {
    title: 'Discount policy',
    message: 'Discounts are disabled by the current store policy.',
    type: 'warning',
  },
  discount_limit_exceeded: {
    title: 'Discount policy',
    message: 'Discount exceeds the maximum allowed by the current store policy.',
    type: 'warning',
  },
  pricing_policy_unavailable: {
    title: 'Pricing policy unavailable',
    message: 'Pricing policy is unavailable. Retry after POS configuration refreshes.',
    type: 'error',
  },
  tax_policy_unavailable: {
    title: 'Tax policy unavailable',
    message: 'Tax policy is unavailable. Retry after POS configuration refreshes.',
    type: 'error',
  },
  tax_policy_invalid: {
    title: 'Tax policy error',
    message: 'Tax policy configuration is invalid. Contact an administrator before checkout.',
    type: 'error',
  },
};

export const normalizePopupContent = (message, title = 'Notice', type) => {
  const policyMessage = POS_POLICY_MESSAGES[String(message || '').trim()];
  if (policyMessage) return policyMessage;

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
  return { title, message, type: inferredType };
};

export const PopupProvider = ({ children }) => {
  const [popup, setPopup] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  const showPopup = useCallback((message, title = 'Notice', type) => {
    const normalized = normalizePopupContent(message, title, type);
    setPopup({ isOpen: true, ...normalized });
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