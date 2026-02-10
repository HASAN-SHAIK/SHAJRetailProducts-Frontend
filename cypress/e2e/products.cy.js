describe('Products Page – End-to-End Tests', () => {
  const base = 'https://inventorymanagement-frontend-qa.onrender.com';

  beforeEach(() => {
    cy.visit(base);
    cy.get('input[type="email"]').type('admin@example.com');
    cy.get('input[type="password"]').type('admin');
    cy.get('button').contains(`Let's Go`).click();
    cy.contains('Products').click();
    cy.url().should('include', '/products');
  });

  it('Add Product Successfully', () => {
    cy.wait(6000)
    cy.contains('Add Product').click();

    cy.get('#addProductModal').should('be.visible');

    cy.get('#product_name').type('TestProduct' + Date.now());
    cy.get('#company').type('TestCompany');
    cy.get('#selling_price').type('200');
    cy.get('#actual_price').type('150');
    cy.get('#stock_quantity').type('10'); 
    cy.get('#category').select('Electronics');
    cy.get('#time_for_delivery').type('2');

    cy.contains('Save').click();
    cy.wait(2000); // wait for the modal to close

  });

  it('Search for a Product', () => {
    cy.get('input[placeholder="Search products..."]').type('TestProduct');
    cy.wait(1000); // wait for filtering

    cy.get('table').find('tr').should('have.length.greaterThan', 1);
    cy.get('table').contains('TestProduct').should('exist');
  });

  it('Sort Products by Name', () => {
    cy.get('select').first().select('Name');
    cy.wait(1000); // wait for sorting

    cy.get('table tbody tr').first().within(() => {
      cy.get('td').first().invoke('text').then((firstName) => {
        expect(firstName.length).to.be.greaterThan(0);
      });
    });
  });

  it('Sort Products by Company', () => {
    cy.get('select').first().select('Company');
    cy.wait(1000); // wait for sorting

    cy.get('table tbody tr').first().within(() => {
      cy.get('td').eq(1).invoke('text').then((firstCompany) => {
        expect(firstCompany.length).to.be.greaterThan(0);
      });
    });
  });
});
