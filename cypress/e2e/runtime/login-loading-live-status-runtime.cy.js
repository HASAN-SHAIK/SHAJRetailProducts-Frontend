describe('Cycle C login loading live-status accessibility runtime', () => {
  let loginWrites = 0;

  beforeEach(() => {
    loginWrites = 0;

    cy.intercept('POST', '**/api/auth/login', (req) => {
      loginWrites += 1;
      req.reply({
        delay: 3000,
        statusCode: 401,
        body: { message: 'Invalid email or password' },
      });
    }).as('login');
  });

  it('announces the pending sign-in state through a polite status live region', () => {
    cy.visit('/');

    cy.get('#login-email').should('be.visible').type('cycle-c@example.test');
    cy.get('#login-password').should('be.visible').type('not-a-real-password', { log: false });
    cy.get('button[type="submit"]').should('be.enabled').click();

    cy.get('button[type="submit"]').should('be.disabled');
    cy.get('[aria-label="Signing in"]').should('exist');
    cy.get('[role="status"][aria-live="polite"]')
      .should('exist')
      .and('be.visible')
      .and('contain.text', 'Signing in');

    cy.wait('@login');
    cy.contains('Invalid email or password').should('be.visible');
    cy.get('[role="alert"][aria-live="assertive"]').should('contain.text', 'Invalid email or password');
    cy.get('button[type="submit"]').should('be.enabled');

    cy.then(() => {
      expect(loginWrites, 'login writes').to.eq(1);
      cy.log(`CYCLE_C_LOGIN_LOADING_LOGIN_WRITES=${loginWrites}`);
      cy.log('CYCLE_C_LOGIN_LOADING_LIVE_STATUS_RUNTIME_PASS=true');
    });
  });
});
