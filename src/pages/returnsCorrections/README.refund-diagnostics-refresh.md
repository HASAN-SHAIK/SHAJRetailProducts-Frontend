# Refund diagnostics refresh contract

The local POS refund clients signal a browser-local refresh event after a successful full refund and whenever POS returns `refund_reconciliation_required`.

`ReturnHistoryPanel` listens only for the currently selected order and refreshes both durable partial-return history and the read-only reconciliation snapshot. This event does not authorize, retry, reconcile, or mutate a refund.
