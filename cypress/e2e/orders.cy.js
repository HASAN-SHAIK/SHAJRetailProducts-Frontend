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

describe('Orders Page E2E', () => {
  before(() => {
    const productName = `E2E Product ${Date.now()}`;
    Cypress.env('productName', productName);

    cy.login();
    getAuthHeaders().then((headers) => {
      cy.request({
        method: 'POST',
        url: `${apiUrl}/products`,
        headers,
        body: {
          product_name: productName,
          category: 'E2E',
          selling_price: 120,
          stock_quantity: 50,
          company: 'E2E Co',
          purchase_price: 90,
          time_for_delivery: '2 days',
        },
      });
    });
  });

  beforeEach(() => {
    cy.login();
  });

  it('loads orders page and shows controls', () => {
    cy.visit('/orders');
    cy.get('input[placeholder="Search by OrderId"]').should('be.visible');
    cy.get('select').should('be.visible');
    cy.contains('button', /sync offline/i).should('be.visible');
    cy.get('table').should('exist');
  });

  it('renders offline queued rows', () => {
    const offlineQueue = [
      {
        id: `offline-${Date.now()}`,
        type: 'create',
        createdAt: new Date().toISOString(),
        payload: {
          client_order_id: '11111111-1111-4111-8111-111111111111',
          user_id: 1,
          transaction_type: 'sale',
          payment_method: 'cash',
          products: [{ product_id: 1, quantity: 1, selling_price: 10 }],
          items: [{ product_name: 'Offline Item', quantity: 1, selling_price: 10 }],
          total_amount: 10,
          total_price: 10,
        },
      },
    ];

    cy.visit('/orders', {
      onBeforeLoad(win) {
        win.localStorage.setItem('offline_order_queue_v1', JSON.stringify(offlineQueue));
      },
    });

    cy.contains('td', /offline-/i).should('be.visible');
    cy.contains('queued').should('be.visible');
    cy.contains('Offline').should('be.visible');
  });

  it('creates, updates, and deletes an order', () => {
    const productName = Cypress.env('productName');

    cy.visit('/neworder');

    cy.get('input[type="radio"][value="sale"]').click({ force: true });
    cy.get('input[type="radio"][value="cash"]').click({ force: true });

    cy.get('input[placeholder="Search Product"]').type(productName);
    cy.contains('li', productName).click();

    cy.get('[data-testid="sale-quantity-input"]').clear().type('2');

    cy.contains('button', /create order/i).click();
    cy.url().should('include', '/orders');

    cy.contains('td', productName).parents('tr').as('orderRow');
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
  });
});
