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
  cy.location('pathname', { timeout: 60000 }).should((pathname) => {
    expect(
      ['/dashboard', '/setup', '/m/dashboard'].some((route) => pathname.includes(route))
    ).to.eq(true);
  });
  cy.location('pathname', { timeout: 90000 }).should('not.include', '/setup');
});

Cypress.Commands.add('loginAndOpen', (path = '/dashboard', email, password) => {
  const userEmail = email || Cypress.env('email');
  const userPassword = password || Cypress.env('password');

  cy.viewport(1440, 900);
  cy.session([userEmail, userPassword], () => {
    cy.login(userEmail, userPassword);
  });

  cy.visit(path);
  cy.location('pathname', { timeout: 30000 }).should('include', path);
});
