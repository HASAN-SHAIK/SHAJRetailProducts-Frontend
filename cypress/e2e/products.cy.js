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

describe('Products Page E2E (Real Backend)', () => {
  before(() => {
    const seedName = `E2E Seed ${Date.now()}`;
    Cypress.env('seedProductName', seedName);
    cy.login();
    getAuthHeaders().then((headers) => {
      cy.request({
        method: 'POST',
        url: `${apiUrl}/products`,
        headers,
        body: {
          product_name: seedName,
          category: 'E2E',
          selling_price: 120,
          stock_quantity: 50,
          company: 'E2E Co',
          actual_price: 90,
          time_for_delivery: '2',
        },
      }).then((res) => {
        const productId = res?.body?.product?.id || res?.body?.id || res?.body?.product_id;
        Cypress.env('seedProductId', productId);
      });
    });
  });

  after(() => {
    deleteProductById(Cypress.env('seedProductId'));
  });

  beforeEach(() => {
    cy.login();
    cy.visit('/products');
    cy.url().should('include', '/products');
  });

  it('loads products page and shows controls', () => {
    cy.contains('button', 'Add Product').should('be.visible');
    cy.get('input[placeholder="Search Products. . . ."]').should('be.visible');
    cy.get('select').should('have.length.at.least', 2);
    cy.get('table').should('exist');
  });

  it('adds a product and shows success', () => {
    const productName = `E2E UI ${Date.now()}`;
    Cypress.env('uiProductName', productName);

    cy.contains('Add Product').click();
    cy.get('#addProductModal').should('be.visible');

    cy.get('#product_name').type(productName);
    cy.get('#company').type('UI Co');
    cy.get('#category').type('E2E');
    cy.get('#selling_price').type('200');
    cy.get('#actual_price').type('150');
    cy.get('#stock_quantity').type('10');
    cy.get('#time_for_delivery').type('2');
    cy.get('#is_weight_based').select('0');

    cy.contains('button', 'Save').click();
    cy.contains('Product added successfully!').should('be.visible');

    cy.get('input[placeholder="Search Products. . . ."]').clear().type(productName);
    cy.contains('td', productName).should('be.visible');

    deleteProductByName(productName);
  });

  it('searches by product name', () => {
    const seedName = Cypress.env('seedProductName');
    cy.get('input[placeholder="Search Products. . . ."]').clear().type(seedName);
    cy.contains('td', seedName).should('be.visible');
  });

  it('sorts products by name and company', () => {
    cy.get('select').last().select('name');
    cy.get('table tbody tr').first().find('td').first().invoke('text').should('not.be.empty');

    cy.get('select').last().select('company');
    cy.get('table tbody tr').first().find('td').eq(1).invoke('text').should('not.be.empty');
  });
});
