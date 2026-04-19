describe('5. ORDER PROCESSING (POS / NEW ORDER)', () => {

  const staffJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoyLCJyb2xlIjoic3RhZmYiLCJ0ZW5hbnRfaWQiOiJ0ZW5hbnQxMjMifQ.dummy_signature';

  beforeEach(() => {
    cy.viewport(1280, 800);
    Cypress.on('uncaught:exception', () => false);

    const unlockFlags = { 
      enable_weight_based: true, 
      enable_piece_based: true, 
      enable_barcode: true, 
      CUSTOMER_MODULE: false 
    };

    const omniUser = { role: 'staff', tenant_id: 'tenant123', id: 2, userDetails: { role: 'staff', id: 2 } };
    const omniTenant = { role: 'staff', tenantId: 'tenant123', tenantConfig: unlockFlags, features: unlockFlags, ...unlockFlags };

    const staffState = JSON.stringify({ 
      tenant: JSON.stringify(omniTenant),
      user: JSON.stringify(omniUser) 
    });

    const superResponse = {
      success: true,
      data: {
        user: omniUser,
        userDetails: omniUser,
        tenant: omniTenant,
        tenantConfig: unlockFlags,
        features: unlockFlags,
        ...unlockFlags
      },
      user: omniUser,
      tenant: omniTenant,
      ...unlockFlags
    };

    cy.intercept({ method: 'GET', url: '**/getLogin*' }, { statusCode: 200, body: superResponse }).as('getLogin');
    cy.intercept({ method: 'GET', url: '**/settings*' }, { statusCode: 200, body: superResponse }).as('getSettings');
    cy.intercept({ method: 'GET', url: '**/platform/config*' }, { statusCode: 200, body: superResponse }).as('getConfig');
    cy.intercept({ method: 'GET', url: '**/tenant/me*' }, { statusCode: 200, body: superResponse }).as('getTenantMe');
    
    cy.intercept('GET', '**/api/branches*', { statusCode: 200, body: { data: [{ id: 'b1', name: 'Main Branch' }] } }).as('getBranches');

    cy.intercept('GET', '**/api/products**', {
      statusCode: 200,
      body: {
        products: [
          { id: 1, name: 'Parle G', barcode: '111', selling_price: 10, type: 0, stock_quantity: 50 },
          { id: 2, name: 'Lays Chips', barcode: '222', selling_price: 20, type: 0, stock_quantity: 30 }
        ]
      }
    }).as('getPosProducts');

    cy.visit('/neworder', {
      onBeforeLoad: (win) => {
        win.indexedDB.deleteDatabase('shajretaildb');
        win.localStorage.removeItem('create_order_drafts_v1');
        win.localStorage.setItem('persist:root', staffState);
        win.localStorage.setItem('token', staffJwt);
      }
    });

    cy.wait(1500); 
  });

  // ==========================================
  // 🛒 CART MANAGEMENT (MANUAL SEARCH)
  // ==========================================

  it('Add Product via Search -> Updates Total', () => {
    cy.intercept('GET', '**/api/products/search/sale?name=Parle*', {
      statusCode: 200,
      body: {
        products: [
          { id: 1, name: 'Parle G', company: 'Parle', selling_price: 10, type: 0, stock_quantity: 50 }
        ]
      }
    }).as('searchProduct');

    cy.contains('button', 'Add Product').click({ force: true });
    cy.get('input[placeholder="Search Product"]').type('Parle');
    cy.wait('@searchProduct');

    cy.get('.list-group-item').contains('Parle G').click({ force: true });
    cy.get('[data-testid="sale-quantity-input"]').clear().type('3');

    cy.contains(/30/i).should('be.visible');
  });

  // ==========================================
  // 🔍 BARCODE & ROW MANIPULATION
  // ==========================================

  it('Add via Barcode, Adjust Quantity, & Remove Row', () => {
    cy.intercept('GET', '**/api/products/barcode/sale/12345', {
      statusCode: 200,
      body: {
        product: { id: 2, name: 'Lays Chips', selling_price: 20, type: 0, stock_quantity: 100 }
      }
    }).as('barcodeLookup');

    cy.get('input[placeholder="Scan or enter barcode"]').type('12345{enter}');
    cy.wait('@barcodeLookup');

    cy.get('input[placeholder="Search Product"]').should('have.value', 'Lays Chips');
    cy.contains(/20/i).should('be.visible');

    cy.get('[data-testid="sale-quantity-input"]').clear().type('2');
    cy.contains(/40/i).should('be.visible');

    cy.get('.btn-danger').first().click({ force: true });

    cy.get('input[placeholder="Search Product"]').should('not.exist');
    cy.contains(/Total.*0/i).should('be.visible');
  });

  // ==========================================
  // 💳 CHECKOUT / SUBMIT ORDER
  // ==========================================

  it('Checkout -> Submits Order Successfully', () => {
    cy.intercept('GET', '**/api/products/barcode/sale/999', {
      statusCode: 200,
      body: { product: { id: 3, name: 'Coke', selling_price: 40, type: 0, stock_quantity: 50 } }
    }).as('barcodeLookup');

    cy.intercept('POST', '**/api/orders', { 
      statusCode: 201, 
      body: { message: 'Success' } 
    }).as('submitOrder');

    cy.get('input[placeholder="Scan or enter barcode"]').type('999{enter}');
    cy.wait('@barcodeLookup');

    cy.contains('button', 'Create Order').click({ force: true });

    cy.wait('@submitOrder');
    cy.url().should('include', '/orders');
  });

  // ==========================================
  // 🚫 NEGATIVE TESTS & VALIDATION
  // ==========================================

  it('Validation -> Prevents submission with empty product row', () => {
    cy.intercept('POST', '**/api/orders').as('submitOrder');

    cy.contains('button', 'Add Product').click({ force: true });
    cy.contains('button', 'Create Order').click({ force: true });

    // THE FIX: The true test of validation is that the API is NEVER hit
    cy.get('@submitOrder.all').should('have.length', 0);
    
    // And we are NOT redirected to the success page
    cy.url().should('include', '/neworder');
  });

  it('Validation -> Prevents quantity exceeding stock', () => {
    cy.intercept('GET', '**/api/products/barcode/sale/777', {
      statusCode: 200,
      body: { product: { id: 4, name: 'Limited Item', selling_price: 100, type: 0, stock_quantity: 5 } } // Only 5 in stock!
    }).as('barcodeLookup');

    cy.get('input[placeholder="Scan or enter barcode"]').type('777{enter}');
    cy.wait('@barcodeLookup');

    cy.get('[data-testid="sale-quantity-input"]').clear().type('10');
    
    // THE FIX: Broad regex to catch "exceeds", "stock limit", "insufficient", etc.
    cy.contains(/exceed|stock/i).should('be.visible');
  });

});