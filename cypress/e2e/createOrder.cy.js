const apiUrl = Cypress.env('apiUrl');

const getAuthHeaders = () => {
  return cy.getCookie('token').then((cookie) => {
    expect(cookie, 'auth cookie').to.exist;
    return cy.window().then((win) => {
      const deviceId = win.localStorage.getItem('device_id');
      expect(deviceId, 'device id').to.be.a('string');
      return {
        Cookie: `token=${cookie.value}`,
        'x-device-id': deviceId,
      };
    });
  });
};

const deleteOrderById = (orderId) => {
  if (!orderId) return;
  getAuthHeaders().then((headers) => {
    cy.request({
      method: 'DELETE',
      url: `${apiUrl}/orders/${orderId}`,
      headers,
      failOnStatusCode: false,
    });
  });
};

const deleteProductById = (productId) => {
  if (!productId) return;
  getAuthHeaders().then((headers) => {
    cy.request({
      method: 'DELETE',
      url: `${apiUrl}/products/${productId}`,
      headers,
      failOnStatusCode: false,
    });
  });
};

const deleteProductByName = (name) => {
  if (!name) return;
  getAuthHeaders().then((headers) => {
    cy.request({
      method: 'GET',
      url: `${apiUrl}/products`,
      headers,
    }).then((res) => {
      const list = Array.isArray(res.body) ? res.body : [];
      const match = list.find((p) => p.name === name || p.product_name === name);
      if (match?.id) {
        deleteProductById(match.id);
      }
    });
  });
};

const registerUser = (email, password) => {
  return cy.request({
    method: 'POST',
    url: `${apiUrl}/auth/register`,
    body: { email, password },
    failOnStatusCode: false,
  });
};

const deleteUser = (email, password) => {
  if (!email || !password) return;
  return cy.request({
    method: 'POST',
    url: `${apiUrl}/auth/delete`,
    body: { email, password },
    failOnStatusCode: false,
  });
};

describe('Create Order Page E2E (Real Backend)', () => {
  before(() => {
    const pieceName = `E2E Piece ${Date.now()}`;
    const weightName = `E2E Weight ${Date.now()}`;
    Cypress.env('pieceProductName', pieceName);
    Cypress.env('weightProductName', weightName);

    cy.login();
    getAuthHeaders().then((headers) => {
      cy.request({
        method: 'POST',
        url: `${apiUrl}/products`,
        headers,
        body: {
          product_name: pieceName,
          category: 'E2E',
          selling_price: 50,
          stock_quantity: 100,
          company: 'E2E Co',
          actual_price: 35,
          time_for_delivery: '2',
          is_weight_based: 0,
        },
      }).then((res) => {
        const productId = res?.body?.product?.id || res?.body?.id || res?.body?.product_id;
        Cypress.env('pieceProductId', productId);
      });

      cy.request({
        method: 'POST',
        url: `${apiUrl}/products`,
        headers,
        body: {
          product_name: weightName,
          category: 'E2E',
          selling_price: 80,
          stock_quantity: 5,
          company: 'E2E Co',
          actual_price: 60,
          time_for_delivery: '2',
          is_weight_based: 1,
        },
      }).then((res) => {
        const productId = res?.body?.product?.id || res?.body?.id || res?.body?.product_id;
        Cypress.env('weightProductId', productId);
      });
    });
  });

  after(() => {
    deleteProductById(Cypress.env('pieceProductId'));
    deleteProductById(Cypress.env('weightProductId'));
  });

  beforeEach(() => {
    const email = `e2e_${Date.now()}_${Cypress._.random(1000)}@example.com`;
    const password = 'Test@12345';
    Cypress.env('testEmail', email);
    Cypress.env('testPassword', password);

    registerUser(email, password);
    cy.login(email, password, { skipRegister: true });
    cy.visit('/neworder');
    cy.url().should('include', '/neworder');
  });

  afterEach(() => {
    deleteUser(Cypress.env('testEmail'), Cypress.env('testPassword'));
  });

  it('validates missing transaction type', () => {
    cy.contains('button', /create order/i).click();
    cy.contains('Select transaction type').should('be.visible');
  });

  it('validates missing payment method for personal', () => {
    cy.get('input[type="radio"][value="personal"]').click({ force: true });
    cy.contains('button', /create order/i).click();
    cy.contains('Select payment method').should('be.visible');
  });

  it('validates missing amount for personal transaction', () => {
    cy.get('input[type="radio"][value="personal"]').click({ force: true });
    cy.get('input[type="radio"][value="cash"]').click({ force: true });
    cy.contains('button', /create order/i).click();
    cy.contains('Enter amount for personal transaction').should('be.visible');
  });

  it('creates, updates, and deletes a sale order (piece product)', () => {
    const productName = Cypress.env('pieceProductName');

    cy.get('input[type="radio"][value="sale"]').click({ force: true });
    cy.get('input[type="radio"][value="cash"]').click({ force: true });

    cy.contains('button', 'Add Product').click();
    cy.get('input[placeholder="Search Product"]').type(productName);
    cy.contains('li', productName).click();
    cy.get('[data-testid="sale-quantity-input"]').clear().type('2');

    cy.contains('button', /create order/i).click();
    cy.url().should('include', '/orders');

    cy.contains('td', productName).parents('tr').as('orderRow');
    cy.get('@orderRow').find('td').first().invoke('text').then((text) => {
      Cypress.env('saleOrderId', text.trim());
    });
    cy.get('@orderRow').contains(`${productName} - Qty: 2 pcs`).should('be.visible');

    cy.get('@orderRow').contains('Edit').click();
    cy.url().should('include', '/neworder');

    cy.get('[data-testid="sale-quantity-input"]').clear().type('3');
    cy.contains('button', /update order/i).click();
    cy.url().should('include', '/orders');

    cy.contains('td', productName).parents('tr').as('updatedRow');
    cy.get('@updatedRow').contains(`${productName} - Qty: 3 pcs`).should('be.visible');
    cy.get('@updatedRow').contains('Delete').click();
    cy.get('@updatedRow').contains('Deleted').should('be.visible');

    deleteOrderById(Cypress.env('saleOrderId'));
  });

  it('validates weight-based quantity rules', () => {
    const weightName = Cypress.env('weightProductName');

    cy.get('input[type="radio"][value="sale"]').click({ force: true });
    cy.contains('button', 'Add Product').click();
    cy.get('input[placeholder="Search Product"]').type(weightName);
    cy.contains('li', weightName).click();

    cy.contains('Use decimal for kg, e.g., 1.25').should('be.visible');
    cy.get('[data-testid="sale-quantity-input"]').clear().type('1.25');
    cy.get('[data-testid="sale-quantity-input"]').should('have.value', '1.25');

    cy.get('[data-testid="sale-quantity-input"]').clear().type('6');
    cy.contains('Entered weight exceeds stock').should('be.visible');
  });

  it('creates and deletes a purchase order', () => {
    const purchaseName = `E2E Purchase ${Date.now()}`;
    Cypress.env('purchaseProductName', purchaseName);

    cy.get('input[type="radio"][value="purchase"]').click({ force: true });
    cy.get('input[type="radio"][value="online"]').click({ force: true });

    cy.contains('button', 'Add Product').click();

    cy.get('input[placeholder="product name"]').type(purchaseName);
    cy.get('input[placeholder="company"]').type('Purchase Co');
    cy.get('input[placeholder="quantity"]').type('10');
    cy.get('input[placeholder="actual price"]').type('60');
    cy.get('input[placeholder="selling price"]').type('90');
    cy.get('input[placeholder="Category"]').type('E2E');
    cy.get('input[placeholder="time for delivery"]').type('2');

    cy.contains('button', /create order/i).click();
    cy.url().should('include', '/orders');

    cy.contains('td', purchaseName).parents('tr').as('purchaseRow');
    cy.get('@purchaseRow').find('td').first().invoke('text').then((text) => {
      Cypress.env('purchaseOrderId', text.trim());
    });
    cy.get('@purchaseRow').contains(purchaseName).should('be.visible');

    cy.get('@purchaseRow').contains('Delete').click();
    cy.get('@purchaseRow').contains('Deleted').should('be.visible');

    deleteOrderById(Cypress.env('purchaseOrderId'));
    deleteProductByName(purchaseName);
  });
});
