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

const ensureTrackedShape = () => ({
  orders: [],
  products: [],
  customers: [],
  suppliers: [],
  staff: [],
  expenses: [],
  salaries: [],
  ewayBills: [],
});

Cypress.Commands.add('resetTrackedEntities', () => {
  Cypress.env('__trackedEntities', ensureTrackedShape());
});

Cypress.Commands.add('trackEntity', (entityType, id) => {
  if (!entityType || id === undefined || id === null || id === '') return;
  const current = Cypress.env('__trackedEntities') || ensureTrackedShape();
  const next = { ...ensureTrackedShape(), ...current };
  if (!Array.isArray(next[entityType])) {
    next[entityType] = [];
  }
  const value = String(id);
  if (!next[entityType].includes(value)) {
    next[entityType].push(value);
  }
  Cypress.env('__trackedEntities', next);
});

Cypress.Commands.add('apiAuthHeaders', () => {
  const email = Cypress.env('email');
  const password = Cypress.env('password');
  const apiUrl = Cypress.env('apiUrl');
  if (!email || !password) {
    throw new Error('Missing credentials. Set CYPRESS_EMAIL and CYPRESS_PASSWORD.');
  }
  if (!apiUrl) {
    throw new Error('Missing CYPRESS_API_URL.');
  }
  return cy
    .request({
      method: 'POST',
      url: `${apiUrl}/auth/login`,
      body: {
        email,
        password,
        device_id: `cypress-${Date.now()}`,
      },
    })
    .then((res) => {
      const token = res.body?.token;
      expect(token, 'tenant token').to.be.a('string').and.not.empty;
      return {
        Authorization: `Bearer ${token}`,
      };
    });
});

Cypress.Commands.add('cleanupTrackedEntities', (headers) => {
  const tracked = Cypress.env('__trackedEntities') || ensureTrackedShape();
  const hasAnything = Object.values(tracked).some((list) => Array.isArray(list) && list.length > 0);
  if (!hasAnything) {
    return cy.wrap(null, { log: false });
  }

  const apiUrl = Cypress.env('apiUrl');
  const withHeaders = (cb) =>
    headers ? cy.wrap(headers, { log: false }).then(cb) : cy.apiAuthHeaders().then(cb);

  const requestSafe = (reqHeaders, method, path, body) =>
    cy.request({
      method,
      url: `${apiUrl}${path}`,
      headers: reqHeaders,
      body,
      failOnStatusCode: false,
      log: false,
    });

  return withHeaders((reqHeaders) => {
    cy.wrap(tracked.orders, { log: false }).each((id) => requestSafe(reqHeaders, 'DELETE', `/orders/${id}`));
    cy.wrap(tracked.products, { log: false }).each((id) => requestSafe(reqHeaders, 'DELETE', `/products/${id}`));

    // Customer & supplier modules don't expose delete endpoints in this branch.
    // We deactivate instead to keep test data from cluttering active lists.
    cy.wrap(tracked.customers, { log: false }).each((id) =>
      requestSafe(reqHeaders, 'PUT', `/customers/${id}`, { is_active: false, is_deleted: true })
    );
    cy.wrap(tracked.suppliers, { log: false }).each((id) =>
      requestSafe(reqHeaders, 'PUT', `/suppliers/${id}`, { is_active: false, is_deleted: true })
    );

    cy.wrap(tracked.staff, { log: false }).each((id) => requestSafe(reqHeaders, 'DELETE', `/staff/${id}`));
    cy.wrap(tracked.expenses, { log: false }).each((id) => requestSafe(reqHeaders, 'DELETE', `/expenses/${id}`));
    cy.wrap(tracked.salaries, { log: false }).each((id) => requestSafe(reqHeaders, 'DELETE', `/salary/${id}`));
    cy.wrap(tracked.ewayBills, { log: false }).each((id) => requestSafe(reqHeaders, 'DELETE', `/eway-bills/${id}`));

    Cypress.env('__trackedEntities', ensureTrackedShape());
  });
});
