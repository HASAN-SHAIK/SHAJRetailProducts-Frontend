# Store-local POS API adapter

The existing React screens, routes, components, styling, and user workflows are unchanged. The adapter is selected only through the existing `RepositoryFactory` boundary.

## Enable

Set `REACT_APP_POS_LOCAL_API_ENABLED=true`. The default local endpoint is `http://127.0.0.1:4782/api/v1`; override it with `REACT_APP_POS_LOCAL_API_URL` only for development or controlled packaging.

The local API token must **not** be compiled into a production web bundle. Production desktop packaging should expose an asynchronous native bridge at `window.shajPosBridge.getLocalApiToken()`. For local development only, `REACT_APP_POS_LOCAL_API_TOKEN` is accepted when `NODE_ENV !== production`.

## Repository routing

When enabled, `RepositoryFactory` selects local POS adapters for the sale-time repositories that need offline execution:

- products/catalog barcode and ID lookup
- customer search/read/create/update
- sales order create/list/detail/payment/completion

The adapters inherit or delegate to the current API/IndexedDB repositories for cache behavior and for legacy operations that are not yet store-local (for example returns/corrections). Disabling the feature flag restores the existing repository selection without changing screens.

## Checkout behavior

`createOrder` writes the local order with its stable `client_order_id`, records each payment using a stable client payment id, and completes the order to issue inventory, receipt, and the durable outbox event. Retries are protected by the local service idempotency keys.

The local service remains the store-side source of truth for completed offline sales. Central synchronization is asynchronous and is not on the UI checkout request path.
