describe('Cycle C login double-submit single-flight runtime', () => {
  let loginWrites = 0;

  beforeEach(() => {
    loginWrites = 0;
    cy.intercept('POST', '**/api/auth/login', (req) => {
      loginWrites += 1;
      req.reply({
        delay: 1200,
        statusCode: 401,
        body: { message: 'Invalid email or password' },
      });
    }).as('login');
  });

  it('keeps a delayed real login single-flight when a second submit is attempted', () => {
    cy.visit('/');

    cy.get('#login-email').should('be.visible').type('cycle-c-singleflight@example.test');
    cy.get('#login-password').should('be.visible').type('not-a-real-password', { log: false });

    cy.get('button[type="submit"]').should('be.enabled').click();
    cy.get('.login-form').should('have.attr', 'aria-busy', 'true');
    cy.get('button[type="submit"]').should('be.disabled');

    // Exercise the form path again while the first Central request is still pending.
    // The production isLoading guard must prevent a second network write.
    cy.get('.login-form').trigger('submit');

    cy.wait('@login');
    cy.get('[role="alert"][aria-live="assertive"]')
      .should('be.visible')
      .and('contain.text', 'Invalid email or password');
    cy.get('.login-form').should('have.attr', 'aria-busy', 'false');
    cy.get('button[type="submit"]').should('be.enabled');

    cy.then(() => {
      expect(loginWrites, 'Central login writes').to.eq(1);
      cy.log(`CYCLE_C_LOGIN_SINGLEFLIGHT_WRITES=${loginWrites}`);
      cy.log('CYCLE_C_LOGIN_SINGLEFLIGHT_RUNTIME_PASS=true');
    });
  });
});
