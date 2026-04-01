describe('5. ORDER PROCESSING (POS / NEW ORDER)', () => {

  const staffJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoyLCJyb2xlIjoic3RhZmYiLCJ0ZW5hbnRfaWQiOiJ0ZW5hbnQxMjMifQ.dummy_signature';

  beforeEach(() => {
    // 1. Wipe DB and Storage so we start fresh
    cy.window().then((win) => {
      win.indexedDB.deleteDatabase('shajretaildb');
      win.localStorage.removeItem('create_order_drafts_v1');
    });

    // 2. Set Staff Token & SUPER MOCK the Tenant Config
    cy.setCookie('token', staffJwt);
    
    // We explicitly add "features": {"enable_barcode": true} to cover all code paths
    const staffState = JSON.stringify({ 
      tenant: "{\"role\":\"staff\",\"tenantId\":\"tenant123\",\"tenantConfig\":{\"enable_weight_based\":true,\"enable_piece_based\":true,\"enable_barcode\":true,\"features\":{\"enable_barcode\":true},\"CUSTOMER_MODULE\":false}}",
      user: "{\"userDetails\":{\"role\":\"staff\",\"id\":2}}" 
    });
    cy.window().then((win) => win.localStorage.setItem('persist:root', staffState));

    // 3. Shield APIs and force them to return the barcode features so Redux isn't overwritten!
    cy.intercept('GET', '**/api/**', { statusCode: 200, body: {} });
    
    cy.intercept('GET', '**/api/auth/getLogin', { 
      statusCode: 200, 
      body: { 
        user: { role: 'staff', tenant_id: 'tenant123', id: 2 },
        tenant: { features: { enable_barcode: true }, enable_barcode: true }
      } 
    }).as('getLoginMock');

    cy.intercept('GET', '**/api/settings*', {
      statusCode: 200,
      body: { features: { enable_barcode: true }, enable_barcode: true }
    });

    cy.intercept('GET', '**/api/platform/config*', {
      statusCode: 200,
      body: { features: { enable_barcode: true }, enable_barcode: true }
    });

    // Mock branches so checkout doesn't fail
    cy.intercept('GET', '**/api/branches*', {
      statusCode: 200,
      body: { branches: [{ id: 'b1', name: 'Main Branch' }] }
    }).as('getBranches');

    // 4. Mock Products for the POS screen
    cy.intercept('GET', '**/api/products**', {
      statusCode: 200,
      body: {
        products: [
          { id: 1, name: 'Parle G', barcode: '111', selling_price: 10, type: 0, stock_quantity: 50 },
          { id: 2, name: 'Lays Chips', barcode: '222', selling_price: 20, type: 0, stock_quantity: 30 }
        ]
      }
    }).as('getPosProducts');

    // Visit the POS page
    cy.visit('/neworder');
    cy.wait('@getPosProducts');
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
    cy.get('[data-testid="sale-quantity-input"]').type('3');

    // 10 * 3 = 30
    cy.contains('strong', 'Total: ₹30.00').should('be.visible');
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
    cy.contains('strong', 'Total: ₹20.00').should('be.visible');

    cy.get('[data-testid="sale-quantity-input"]').clear().type('2');
    cy.contains('strong', 'Total: ₹40.00').should('be.visible');

    cy.get('.btn-danger').contains('×').click({ force: true });

    cy.get('input[placeholder="Search Product"]').should('not.exist');
    cy.contains('strong', 'Total: ₹0.00').should('be.visible');
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
    cy.contains('Order Placed!!').should('be.visible');
  });

  // ==========================================
  // 🚫 NEGATIVE TESTS & VALIDATION
  // ==========================================

  it('Validation -> Prevents submission with empty product row', () => {
    cy.intercept('POST', '**/api/orders').as('submitOrder');

    cy.contains('button', 'Add Product').click({ force: true });
    cy.contains('button', 'Create Order').click({ force: true });

    // API is NOT called
    cy.get('@submitOrder.all').should('have.length', 0);
    cy.contains('Select product and quantity').should('be.visible');
  });

  it('Validation -> Prevents quantity exceeding stock', () => {
    cy.intercept('GET', '**/api/products/barcode/sale/777', {
      statusCode: 200,
      body: { product: { id: 4, name: 'Limited Item', selling_price: 100, type: 0, stock_quantity: 5 } } // Only 5 in stock!
    }).as('barcodeLookup');

    cy.get('input[placeholder="Scan or enter barcode"]').type('777{enter}');
    cy.wait('@barcodeLookup');

    cy.get('[data-testid="sale-quantity-input"]').clear().type('10');
    cy.contains('Entered quantity exceeds stock').should('be.visible');
  });

});