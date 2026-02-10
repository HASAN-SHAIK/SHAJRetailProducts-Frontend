describe('Login Test', () => {
  it('Should successfully login', () => {
    cy.visit('https://inventorymanagement-frontend-qa.onrender.com');

    cy.get('input[type="email"]').type('admin@example.com');
    cy.get('input[type="password"]').type('admin');
    cy.get('button[type="submit"]').click();
    cy.wait(7000); // Wait for the login to complete
    cy.url().should('include', '/dashboard');
    cy.contains('Dashboard').should('exist');
  });
});
