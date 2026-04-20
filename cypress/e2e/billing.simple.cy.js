describe('Billing - Simple E2E Flow', () => {
  it('opens billing, searches product, and adds product to cart', () => {
    const uniqueSearch = `e2e-simple-${Date.now()}`;
    const mockedProduct = {
      id: 999001,
      name: 'E2E Simple Product',
      company: 'SHAJ Test Co',
      selling_price: 120,
      stock_quantity: 25,
    };

    cy.intercept('GET', '**/products/search/sale*', (req) => {
      if (req.query?.name === uniqueSearch) {
        req.reply({
          statusCode: 200,
          body: { data: [mockedProduct] },
        });
        return;
      }
      req.continue();
    }).as('searchProducts');

    cy.loginAndOpen('/billing/retail');

    cy.get('input[placeholder="Search by name, company, or barcode"]')
      .should('be.visible')
      .clear()
      .type(uniqueSearch);

    cy.wait('@searchProducts');
    cy.contains('.billing-search-item', mockedProduct.name, { timeout: 10000 }).click();

    cy.contains('table tbody tr', mockedProduct.name, { timeout: 10000 }).should('exist');
    cy.get('.billing-qty-input').first().should('have.value', '1');
  });
});
