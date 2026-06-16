Cypress.Commands.add('mockFrontendSession', (path = '/dashboard') => {
  const email = Cypress.env('email') || 'admin@srh.com';
  const password = Cypress.env('password') || 'admin';
  const adminJwt =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJyb2xlIjoiYWRtaW4iLCJ0ZW5hbnRfaWQiOiJ0ZW5hbnQxMjMifQ.dummy_signature';
  const tenantConfig = {
    receipt_module_enabled: true,
    GST_invoice_enabled: true,
    CUSTOMER_MODULE: true,
    advanced_reports: true,
    analytical_reports: true,
    reports_enabled: true,
    enable_piece_based: true,
    enable_weight_based: true,
    plan_features: {
      receipt_module_enabled: true,
      GST_invoice_enabled: true,
      enable_piece_based: true,
      enable_weight_based: true,
      reports_enabled: true,
    },
  };
  const authResponse = {
    success: true,
    token: adminJwt,
    user: {
      id: 1,
      role: 'admin',
      tenant_id: 'tenant123',
      email,
    },
    tenant: {
      role: 'admin',
      tenantId: 'tenant123',
      tenantConfig,
    },
    tenantConfig,
  };
  const persistState = JSON.stringify({
    tenant: JSON.stringify({
      role: 'admin',
      tenantId: 'tenant123',
      tenantConfig,
      configStatus: 'loaded',
    }),
    user: JSON.stringify({
      userDetails: {
        id: 1,
        role: 'admin',
        tenant_id: 'tenant123',
        email,
      },
    }),
  });
  const emptySyncResponse = {
    success: true,
    data: [],
    deleted_ids: [],
    server_time: '2026-04-21T10:00:00.000Z',
  };

  Cypress.on('uncaught:exception', () => false);

  cy.intercept('POST', '**/api/auth/login', {
    statusCode: 200,
    body: {
      token: adminJwt,
      user: authResponse.user,
    },
  }).as('mockLogin');

  cy.intercept('GET', '**/api/auth/getLogin*', {
    statusCode: 200,
    body: authResponse,
  }).as('getLogin');

  cy.intercept('GET', '**/api/platform/config*', {
    statusCode: 200,
    body: authResponse,
  }).as('getConfig');

  cy.intercept('GET', '**/api/settings*', {
    statusCode: 200,
    body: {
      whatsapp_bill_enabled: false,
    },
  }).as('getSettings');

  cy.intercept('GET', '**/api/tenant/me*', {
    statusCode: 200,
    body: {
      data: {
        ...tenantConfig,
        subscription_status: 'active',
      },
    },
  }).as('getTenantMe');

  cy.intercept('GET', '**/api/banner*', {
    statusCode: 200,
    body: {
      data: {
        show_banner: false,
        days_left: 30,
      },
    },
  }).as('getBanner');

  cy.intercept('GET', '**/api/branches*', {
    statusCode: 200,
    body: {
      data: [{ id: 'b1', name: 'Main Branch' }],
    },
  }).as('getBranches');

  cy.intercept('GET', '**/api/sync/products*', {
    statusCode: 200,
    body: emptySyncResponse,
  }).as('syncProducts');

  cy.intercept('GET', '**/api/sync/batches*', {
    statusCode: 200,
    body: emptySyncResponse,
  }).as('syncBatches');

  cy.intercept('GET', '**/api/sync/suppliers*', {
    statusCode: 200,
    body: emptySyncResponse,
  }).as('syncSuppliers');

  cy.intercept('GET', '**/api/orders/getcategories*', {
    statusCode: 200,
    body: { categories: [] },
  }).as('getCategories');

  cy.intercept('POST', '**/api/products/extra-details', {
    statusCode: 200,
    body: { products: [] },
  }).as('extraDetails');

  cy.intercept('GET', '**/api/**', (req) => {
    if (req.url.includes('/auth/getLogin')) req.reply({ statusCode: 200, body: authResponse });
    else if (req.url.includes('/platform/config')) req.reply({ statusCode: 200, body: authResponse });
    else if (req.url.includes('/settings')) req.reply({ statusCode: 200, body: { whatsapp_bill_enabled: false } });
    else if (req.url.includes('/tenant/me')) req.reply({ statusCode: 200, body: { data: { ...tenantConfig, subscription_status: 'active' } } });
    else if (req.url.includes('/banner')) req.reply({ statusCode: 200, body: { data: { show_banner: false, days_left: 30 } } });
    else if (req.url.includes('/branches')) req.reply({ statusCode: 200, body: { data: [{ id: 'b1', name: 'Main Branch' }] } });
    else if (req.url.includes('/sync/products') || req.url.includes('/sync/batches') || req.url.includes('/sync/suppliers')) req.reply({ statusCode: 200, body: emptySyncResponse });
    else if (req.url.includes('/orders/getcategories')) req.reply({ statusCode: 200, body: { categories: [] } });
    else if (req.url.includes('/orders')) req.reply({ statusCode: 200, body: { orders: [], pagination: { total_records: 0, total_pages: 1, page: 1, limit: 10 }, customer_details_enabled: false } });
    else if (req.url.includes('/transactions')) req.reply({ statusCode: 200, body: { transactions: [], page: 1, limit: 20 } });
    else if (req.url.includes('/customers')) req.reply({ statusCode: 200, body: { customers: [], data: [] } });
    else if (req.url.includes('/suppliers')) req.reply({ statusCode: 200, body: { suppliers: [], data: { suppliers: [] } } });
    else if (req.url.includes('/purchases')) req.reply({ statusCode: 200, body: { purchases: [], data: { purchases: [] } } });
    else if (req.url.includes('/products')) req.reply({ statusCode: 200, body: { products: [], data: [] } });
    else if (req.url.includes('/accounts/outstanding')) req.reply({ statusCode: 200, body: { rows: [], data: { rows: [] } } });
    else req.reply({ statusCode: 200, body: {} });
  }).as('mockApiGet');

  cy.intercept('POST', '**/api/**', {
    statusCode: 200,
    body: { success: true, data: {} },
  }).as('mockApiPost');

  cy.intercept('PUT', '**/api/**', {
    statusCode: 200,
    body: { success: true, data: {} },
  }).as('mockApiPut');

  cy.intercept('DELETE', '**/api/**', {
    statusCode: 200,
    body: { success: true },
  }).as('mockApiDelete');

  cy.visit(path, {
    onBeforeLoad(win) {
      Object.defineProperty(win.navigator, 'onLine', {
        configurable: true,
        get: () => true,
      });
      win.localStorage.clear();
      win.localStorage.setItem('persist:root', persistState);
      win.localStorage.setItem('auth_token', adminJwt);
      win.localStorage.setItem('token', adminJwt);
      win.localStorage.setItem('selected_branch_id', 'all');
      win.localStorage.setItem('selected_branch_confirmed', '1');
      win.localStorage.setItem('selected_branch_name', 'All');
      win.localStorage.setItem('cypress_mock_login_email', email);
      win.localStorage.setItem('cypress_mock_login_password', password);
    },
  });

  cy.location('pathname', { timeout: 30000 }).should('include', path);
  cy.get('body').should('be.visible');
});

Cypress.Commands.add('loginAndOpen', (path = '/dashboard') => {
  cy.mockFrontendSession(path);
});

Cypress.Commands.add("login", () => {
  const email = Cypress.env("email") || "admin@srh.com";
  const password = Cypress.env("password") || "admin";

  if (!email || !password) {
    throw new Error(
      "❌ Missing credentials. Set CYPRESS_EMAIL and CYPRESS_PASSWORD"
    );
  }

  cy.visit("/login");

  cy.log("🔐 Logging in...");

  // Flexible selectors (important)
  cy.get('input[type="email"], input[placeholder*="Email" i]')
    .first()
    .type(email);

  cy.get('input[type="password"]').type(password);

  cy.get("button")
    .contains(/login|sign in|let'?s go/i)
    .click();

  cy.url().should("include", "/dashboard");

  cy.log("✅ Login success");
});
