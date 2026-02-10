Cypress.Commands.add('login', (email, password) => {
  const userEmail = email || Cypress.env('email');
  const userPassword = password || Cypress.env('password');

  if (!userEmail || !userPassword) {
    throw new Error(
      'Missing credentials. Set CYPRESS_EMAIL and CYPRESS_PASSWORD before running E2E tests.'
    );
  }

  cy.visit('/login');
  cy.get('input[name="email"]').clear().type(userEmail);
  cy.get('input[name="password"]').clear().type(userPassword, { log: false });
  cy.contains('button', /let's go/i).click();
  cy.url().should('include', '/dashboard');
});
