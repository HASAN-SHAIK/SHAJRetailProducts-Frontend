# POS management retirement matrix

## Purpose

This matrix defines the final POS-to-RetailHub ownership boundary after the RetailHub replacements for Customers, Staff, Expenses and Accounts are green. POS remains the store execution/offline edge. SHAJ Retail Hub is the tenant business-management/control plane backed by Central/PostgreSQL.

## Authority matrix

| Domain/screen family | Current POS routes | Target owner | POS disposition | Required retained POS capability |
| --- | --- | --- | --- | --- |
| Customer management | `/customers`, `/customers/new`, `/customers/:id`, `/customers/:id/edit`, `/customers/reorder` | RetailHub `/customers` | RETIRE/REDIRECT | Checkout-time customer search/select and architecture-approved lightweight offline capture only |
| Staff management | `/staff-expenses/staff/list`, `/staff-expenses/staff/add`, `/staff-expenses/staff/edit/:staffId`, `/staff-expenses/staff/salary` | RetailHub `/staff` | RETIRE/REDIRECT | Current logged-in operator identity and runtime POS permission enforcement only |
| Expense management/reporting | `/staff-expenses/expenses/add`, `/staff-expenses/expenses/daily`, `/staff-expenses/expenses/monthly`, `/staff-expenses/expenses/staff-wise` | RetailHub `/finance/expenses` | RETIRE/REDIRECT | Genuine store-execution cash/petty-cash action only if required by POS runtime; no management register/report authority |
| Accounts management | `/accounts/receipt`, `/accounts/payment`, `/accounts/cashbook`, `/accounts/bankbook`, `/accounts/ledger`, `/accounts/outstanding` | RetailHub `/finance/accounts` | RETIRE/REDIRECT | Store/register execution only; no accounting books, ledger or outstanding management authority |
| Opening setup | `/accounts/opening-setup` | RetailHub `/finance/accounts` | RETIRE only after POS startup dependency is decoupled | POS may consume Central completion state; POS must not own opening-balance administration |
| Returns/corrections | `/returns-corrections/*` | POS execution unless separately migrated | KEEP | Sale return/correction execution tied to store transaction authority |
| Sync Center | `/sync-center` | POS | KEEP | Connectivity, sync/outbox/dead-letter operational state |
| Billing/orders | `/billing/*`, `/orders/*` | POS | KEEP | Store transaction execution/offline continuity |

## Exact runtime coupling that must be handled before Accounts retirement

`src/App.js` currently gates POS startup/billing on `is_opening_completed` and redirects incomplete tenants to `/accounts/opening-setup`. The same local route is also linked by `OpeningRequired`. Therefore the Accounts management routes must not simply be deleted: first replace this navigation with a RetailHub handoff or a non-authoritative POS message while continuing to consume the Central completion flag.

This is the only discovered hard runtime coupling among the migrated management routes. Customer, Staff and Expense management routes are not required for checkout/offline execution and can be retired independently after their RetailHub replacements remain green.

## Navigation retirement

`src/components/common/Navbar/Navbar.js` currently exposes Customers, Staff & Expenses and Accounts as POS management navigation. Those entries must be removed when the corresponding route retirement lands. The POS navigation must continue to expose Orders, Billing, Inventory execution, Adjustments and Sync Center.

## Acceptance requirements

1. Direct navigation to retired POS management routes no longer renders the old management screens.
2. Billing customer lookup/select remains functional online and offline where already certified.
3. Approved lightweight offline customer capture remains functional and still converges to canonical Central IDs after sync.
4. Logged-in operator identity and POS capability enforcement are unchanged by Staff UI retirement.
5. Expense and Accounts retirement does not remove cash/register execution required for sale completion.
6. POS continues to consume Central `is_opening_completed` state but no longer hosts opening-balance administration once a RetailHub handoff is available.
7. Sync Center, outbox/dead-letter diagnostics and offline sale flows remain intact.
8. Production Frontend build and focused cross-repository migration acceptance are green before merge.

## Dependency-safe retirement order

1. Customers management routes/navigation.
2. Staff management routes/navigation.
3. Expense management/reporting routes/navigation.
4. Accounts read/write management routes/navigation.
5. Decouple opening-setup startup handoff, then retire `/accounts/opening-setup`.
6. Delete unreachable management page code only after routed retirement is proven.
7. Run final Customers + Staff + Finance + Dashboard cross-repository release certification.
