export const REFUND_DIAGNOSTICS_REFRESH_EVENT = 'shaj:refund-diagnostics-refresh';

export const signalRefundDiagnosticsRefresh = (orderId, reason) => {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  const normalizedOrderId = String(orderId || '').trim();
  if (!normalizedOrderId) return;
  window.dispatchEvent(new CustomEvent(REFUND_DIAGNOSTICS_REFRESH_EVENT, {
    detail: {
      orderId: normalizedOrderId,
      reason: String(reason || '').trim() || 'refund_facts_changed',
    },
  }));
};
