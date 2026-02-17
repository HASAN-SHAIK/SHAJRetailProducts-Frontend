Cypress.Commands.add('login', (email, password, options = {}) => {
  const userEmail = email || Cypress.env('email');
  const userPassword = password || Cypress.env('password');
  const apiUrl = Cypress.env('apiUrl');

  if (!userEmail || !userPassword) {
    throw new Error(
      'Missing credentials. Set CYPRESS_EMAIL and CYPRESS_PASSWORD before running E2E tests.'
    );
  }
  if (!apiUrl) {
    throw new Error('Missing CYPRESS_API_URL (env apiUrl) for registration.');
  }

  if (!options.skipRegister) {
    cy.request({
      method: 'POST',
      url: `${apiUrl}/auth/register`,
      body: {
        email: userEmail,
        password: userPassword,
      },
      failOnStatusCode: false,
    });
  }

  cy.visit('/');
  cy.get('input[name="email"]').as('emailInput');
  cy.get('input[name="password"]').as('passwordInput');

  cy.get('@emailInput').clear();
  cy.get('@emailInput').type(userEmail);

  cy.get('@passwordInput').clear();
  cy.get('@passwordInput').type(userPassword, { log: false });

  cy.contains('button', /let's go/i).click();
  cy.url().should('include', '/dashboard');
});
