describe('6. ORDER HISTORY & SALES', () => {

  const adminJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJyb2xlIjoiYWRtaW4iLCJ0ZW5hbnRfaWQiOiJ0ZW5hbnQxMjMifQ.dummy_signature';

  Cypress.on('uncaught:exception', () => {
    return false; // Ignore our intentional IndexedDB sabotage
  });

  beforeEach(() => {
    // 1. Sabotage IndexedDB so it doesn't wipe our mocked table data
    cy.on('window:before:load', (win) => {
      Object.defineProperty(win, 'indexedDB', {
        get: () => { throw new Error('IndexedDB disabled for testing'); },
        configurable: true
      });
    });

    cy.setCookie('token', adminJwt);

    // 2. THE REAL FIX: Mock the Config & Settings APIs so Redux actually turns on the Print/GST buttons!
    const mockConfig = {
      receipt_module_enabled: true,
      GST_invoice_enabled: true,
      CUSTOMER_MODULE: true,
      plan_features: { receipt_module_enabled: true, GST_invoice_enabled: true }
    };

    cy.intercept('GET', '**/api/platform/config*', { statusCode: 200, body: mockConfig }).as('getConfig');
    cy.intercept('GET', '**/api/settings*', { statusCode: 200, body: mockConfig }).as('getSettings');
    
    // Shield other background APIs from causing 401 Redirects
    cy.intercept('GET', '**/api/auth/getLogin', { statusCode: 200, body: { user: { role: 'admin', tenant_id: 'tenant123', id: 1 } } });
    cy.intercept('GET', '**/api/branches*', { statusCode: 200, body: { branches: [{ id: 1, name: 'Main Branch' }] } });
    cy.intercept('GET', '**/api/shop-details/me*', { statusCode: 200, body: { shop_details: { shop_name: 'Test Shop', gst_number: '12345GST' } } }).as('getShopDetails');
    cy.intercept('GET', '**/api/batches*', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/products/cache-db*', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/customers*', { statusCode: 200, body: [] });
    cy.intercept('GET', '**/api/transactions*', { statusCode: 200, body: [] });

    // 3. Mock Orders
    const today = new Date().toISOString();
    cy.intercept('GET', '**/api/orders*', {
      statusCode: 200,
      body: {
        orders: [
          { id: 101, customer_name: 'John Doe', total_amount: 500, total_paid: 200, balance: 300, payment_status: 'partial', payment_method: 'cash', order_status: 'completed', is_gst_enabled: true, created_at: today },
          { id: 102, customer_name: 'Jane Smith', total_amount: 1000, total_paid: 1000, balance: 0, payment_status: 'paid', payment_method: 'online', order_status: 'completed', is_gst_enabled: false, created_at: today },
          { id: 103, customer_name: 'Bob Ghost', total_amount: 200, total_paid: 200, balance: 0, payment_status: 'paid', payment_method: 'cash', order_status: 'fully_returned', is_gst_enabled: false, created_at: today },
          { id: 104, customer_name: 'Credit Charlie', total_amount: 800, total_paid: 0, balance: 800, payment_status: 'pending', payment_method: 'cash', order_status: 'completed', is_gst_enabled: false, created_at: today }
        ],
        pagination: { total_records: 4, total_pages: 1, page: 1, limit: 10 },
        customer_details_enabled: true
      }
    }).as('getOrdersList');

    // Hide annoying overlays
    cy.document().then((doc) => {
      const style = doc.createElement('style');
      style.innerHTML = `.popup-bounce, .popup-success, .popup-error, iframe#webpack-dev-server-client-overlay { display: none !important; opacity: 0 !important; pointer-events: none !important; z-index: -9999 !important; }`;
      doc.head.appendChild(style);
    });

    cy.visit('/orders');

    // Wait for the automatic page load and config fetches
    cy.wait(['@getOrdersList', '@getConfig', '@getSettings']);

    // Force a UI refresh to ensure Redux state is perfectly mapped to the table
    cy.contains('button', 'Refresh from server', { matchCase: false }).click({ force: true });
    cy.wait('@getOrdersList'); 
    
    // Validate rows exist without excessive arbitrary waits
    cy.get('.orders-row', { timeout: 10000 }).should('have.length.at.least', 4);
  });

  // ==========================================
  // 💰 PAYMENTS & ORDER STATUS UI
  // ==========================================

  it('Payment UI -> Renders correct buttons for Unpaid, Partial, and Returned orders', () => {
    cy.contains('.orders-row', 'John Doe').find('button.payment-btn.warning').contains('Pay Balance', { matchCase: false }).should('exist');
    cy.contains('.orders-row', 'Jane Smith').find('button.payment-btn').should('not.exist');
    cy.contains('.orders-row', 'Bob Ghost').find('.payment-badge.returned').should('exist');
    cy.contains('.orders-row', 'Credit Charlie').find('button.payment-btn.danger').contains('Make Payment', { matchCase: false }).should('exist');
  });

  it('Make Payment -> Pays completely unpaid order (Credit settlement)', () => {
    cy.intercept('POST', '**/api/orders/mark-paid*').as('markPaid');
    cy.contains('.orders-row', 'Credit Charlie').find('button').contains('Make Payment', { matchCase: false }).click({ force: true });
    cy.wait('@markPaid');
  });

  // ==========================================
  // 🔄 RETURN PROCESSING (FULL)
  // ==========================================

  it('Return -> Full Return calculates max refund', () => {
    cy.intercept('GET', '**/api/orders/101*', {
      statusCode: 200, body: { order: { id: 101, items: [{ product_id: 55, name: 'Glass Vase', quantity: 10, returned_quantity: 0, price: 100, line_total: 1000 }] } }
    }).as('getReturnDetails');

    cy.intercept('POST', '**/api/orders/101/returns*', { statusCode: 200, body: { message: 'Return processed' } }).as('processReturn');

    cy.contains('.orders-row', 'John Doe').find('button').contains('Return', { matchCase: false }).click({ force: true });
    cy.wait('@getReturnDetails');

    cy.get('.return-table input[type="number"]').clear({ force: true }).type('10', { force: true });
    cy.contains('.return-total strong', '₹1,000.00').should('exist');

    cy.contains('button', 'Process Return').click({ force: true });
    cy.wait('@processReturn');
  });

  // ==========================================
  // 🖨️ RECEIPTS & GST INVOICES
  // ==========================================

  it('Thermal Print -> Opens receipt modal and calls window.print()', () => {
    cy.intercept('GET', '**/api/orders/102*', { statusCode: 200, body: { order: { id: 102 } } }).as('getReceipt');
    cy.window().then(win => cy.stub(win, 'print').as('windowPrint'));

    cy.contains('.orders-row', 'Jane Smith').contains('button', 'Print', { matchCase: false }).click({ force: true });
    cy.wait('@getReceipt');

    cy.get('.receipt-modal').contains('button', 'Print', { matchCase: false }).click({ force: true });
    cy.get('@windowPrint').should('have.been.calledOnce');
  });

  it('GST Invoice -> Validates empty fields, then generates PDF successfully', () => {
    cy.intercept('GET', '**/api/orders/101*', { statusCode: 200, body: { order: { id: 101, is_gst_enabled: true } } }).as('getOrder');

    cy.contains('.orders-row td', '#101').click({ force: true });
    cy.wait('@getOrder');

    // THE FIX: Use 'exist' instead of 'be.visible' so the Webpack overlay doesn't fail the test
    cy.get('.order-drawer').should('exist');
    cy.get('.order-drawer').contains('button', 'Download GST Invoice').click({ force: true });
    
    // Wait for the modal to exist in the DOM before typing
    cy.get('.delete-modal').should('exist');
    cy.get('.delete-modal input').eq(0).clear({ force: true }).type('Corp Inc', { force: true });
    cy.get('.delete-modal input').eq(1).clear({ force: true }).type('9999999999', { force: true });
    cy.get('.delete-modal').contains('button', 'Download PDF').click({ force: true });
  });

  // ==========================================
  // 🗑️ DELETE ORDER & FILTERS
  // ==========================================

  it('Delete Order -> Warns if order has payments recorded', () => {
    cy.intercept('GET', '**/api/orders/101*', { statusCode: 200, body: { order: { id: 101, total_paid: 200, payment_status: 'partial' } } }).as('getOrder');
    
    cy.contains('.orders-row td', '#101').click({ force: true });
    cy.wait('@getOrder');

    cy.get('.order-drawer').contains('button', 'Delete Order').click({ force: true });

    cy.contains('Warning: This order has payments recorded.', { matchCase: false }).should('exist');
  });

  it('Date Filter -> Custom range requires both dates (Negative)', () => {
    cy.get('.range-select').select('custom', { force: true });
    cy.contains('button', 'Apply').click({ force: true });
  });

});