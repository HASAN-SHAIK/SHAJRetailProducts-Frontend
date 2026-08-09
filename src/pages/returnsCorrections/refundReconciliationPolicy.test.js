import { summarizeRefundReconciliation } from './refundReconciliationPolicy';

describe('refund reconciliation presentation policy', () => {
  test('normalizes POS minor/milli units without losing audit or sync facts', () => {
    expect(summarizeRefundReconciliation({
      order_id: 'ord-1',
      order_status: 'paid',
      captured_payment_minor: 10000,
      reversed_payment_minor: 2500,
      sale_issued_quantity_milli: 1000,
      restored_quantity_milli: 250,
      partial_return_operations: 1,
      partial_return_refund_minor: 2500,
      unpublished_sync_facts: 2,
      dead_letter_sync_facts: 1,
    })).toEqual({
      orderId: 'ord-1',
      orderStatus: 'paid',
      capturedAmount: 100,
      reversedAmount: 25,
      issuedQuantity: 1,
      restoredQuantity: 0.25,
      partialReturnOperations: 1,
      partialRefundAmount: 25,
      unpublishedSyncFacts: 2,
      deadLetterSyncFacts: 1,
      paymentDelta: 75,
      inventoryDelta: 0.75,
      hasPaymentMismatch: false,
      hasInventoryMismatch: false,
      hasDeadLetterSyncFacts: true,
    });
  });

  test('flags impossible over-reversal and over-restoration facts without proposing a correction', () => {
    const summary = summarizeRefundReconciliation({
      captured_payment_minor: 1000,
      reversed_payment_minor: 1500,
      sale_issued_quantity_milli: 500,
      restored_quantity_milli: 750,
    });

    expect(summary.hasPaymentMismatch).toBe(true);
    expect(summary.hasInventoryMismatch).toBe(true);
    expect(summary.hasDeadLetterSyncFacts).toBe(false);
    expect(summary.unpublishedSyncFacts).toBe(0);
    expect(summary.deadLetterSyncFacts).toBe(0);
    expect(summary.paymentDelta).toBe(-5);
    expect(summary.inventoryDelta).toBe(-0.25);
  });
});
