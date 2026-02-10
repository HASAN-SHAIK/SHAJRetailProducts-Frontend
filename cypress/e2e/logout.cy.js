describe('Logout Flow', () => {
  beforeEach(() => {
    cy.login();
    cy.wait(5000); // Wait for the login to complete
  });

  it('Should logout successfully', () => {
    cy.contains('Logout').click();
    cy.url().should('include', '/login');
  });
});
