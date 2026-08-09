import { REFUND_DIAGNOSTICS_REFRESH_EVENT, signalRefundDiagnosticsRefresh } from './refundDiagnosticsEvents';

describe('refund diagnostics refresh event', () => {
  test('dispatches the selected order identity and reason', () => {
    const listener = jest.fn();
    window.addEventListener(REFUND_DIAGNOSTICS_REFRESH_EVENT, listener);

    signalRefundDiagnosticsRefresh('ord-1', 'full_refund_succeeded');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].detail).toEqual({
      orderId: 'ord-1',
      reason: 'full_refund_succeeded',
    });

    window.removeEventListener(REFUND_DIAGNOSTICS_REFRESH_EVENT, listener);
  });
});
