describe('Cycle C login credential field semantics runtime', () => {
  let loginWrites = 0;

  beforeEach(() => {
    loginWrites = 0;
    cy.intercept('POST', '**/api/auth/login', (req) => {
      loginWrites += 1;
      req.reply({ statusCode: 401, body: { message: 'Invalid email or password' } });
    }).as('login');
  });

  it('keeps labels and browser credential semantics wired on the real login path', () => {
    cy.visit('/');

    cy.get('label[for="login-email"]').should('be.visible');
    cy.get('#login-email')
      .should('be.visible')
      .and('have.attr', 'autocomplete', 'username')
      .type('cycle-c-semantics@example.test');

    cy.get('label[for="login-password"]').should('be.visible');
    cy.get('#login-password')
      .should('be.visible')
      .and('have.attr', 'autocomplete', 'current-password')
      .type('not-a-real-password', { log: false });

    cy.get('button[type="submit"]').should('be.enabled').click();
    cy.wait('@login');
    cy.get('[role="alert"][aria-live="assertive"]')
      .should('be.visible')
      .and('contain.text', 'Invalid email or password');

    cy.get('#login-email').should('have.attr', 'autocomplete', 'username');
    cy.get('#login-password').should('have.attr', 'autocomplete', 'current-password');

    cy.then(() => {
      expect(loginWrites, 'login writes').to.eq(1);
      cy.log(`CYCLE_C_LOGIN_CREDENTIAL_SEMANTICS_LOGIN_WRITES=${loginWrites}`);
      cy.log('CYCLE_C_LOGIN_CREDENTIAL_SEMANTICS_RUNTIME_PASS=true');
    });
  });
});
