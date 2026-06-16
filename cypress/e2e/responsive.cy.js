describe('📱 RESPONSIVENESS TEST', () => {

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  it('Mobile view → UI should render correctly', () => {

    cy.viewport('iphone-6');   // 🔥 mobile simulation

    cy.visit('/');

    cy.get('body').should('be.visible');

    // Ensure no crash UI
    cy.get('body').then(($body) => {
      const hasBrokenUI =
        $body.text().toLowerCase().includes('error') &&
        !$body.text().toLowerCase().includes('login');

      expect(hasBrokenUI, 'UI should not break on mobile').to.be.false;
    });
  });

});