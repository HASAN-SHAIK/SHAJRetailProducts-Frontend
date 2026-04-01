describe('3. AUTHORIZATION (VERY IMPORTANT)', () => {
  
  const adminJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJyb2xlIjoiYWRtaW4iLCJ0ZW5hbnRfaWQiOiJ0ZW5hbnQxMjMifQ.dummy_signature';
  const staffJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoyLCJyb2xlIjoic3RhZmYiLCJ0ZW5hbnRfaWQiOiJ0ZW5hbnQxMjMifQ.dummy_signature';

  it('Direct URL access without login -> blocked', () => {
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.clearAllSessionStorage();
    
    cy.intercept('GET', '**/api/auth/getLogin', { 
      statusCode: 401,
      body: { message: 'Unauthorized' }
    }).as('sessionCheck');

    cy.visit('/dashboard');
    cy.location('pathname').should('eq', '/');
  });

  it('Admin user -> sees ALL features (Common + Admin Only)', () => {
    cy.setCookie('token', adminJwt);
    const adminState = JSON.stringify({ 
      tenant: "{\"role\":\"admin\",\"tenantId\":\"tenant123\"}",
      user: "{\"userDetails\":{\"role\":\"admin\"}}" 
    });
    cy.window().then((win) => win.localStorage.setItem('persist:root', adminState));

    cy.intercept('GET', '**/api/**', { statusCode: 200, body: {} });
    cy.intercept('GET', '**/api/auth/getLogin', { 
      statusCode: 200, body: { user: { role: 'admin', tenant_id: 'tenant123' } } 
    });

    cy.visit('/dashboard');

    // 1. Verify Common Features exist
    cy.contains('Orders').should('be.visible');
    cy.contains('Expenses').should('be.visible');
    cy.contains('Products').should('be.visible');

    // 2. Verify Admin Features exist
    cy.contains('Devices').should('be.visible');
    cy.get('select.form-select option[value="all"]').should('exist');

    // 3. Verify Admin CAN access the protected admin route
    cy.visit('/branch-devices');
    cy.url().should('include', '/branch-devices');
  });

  it('Staff user -> sees Common features but Admin UI is hidden', () => {
    cy.setCookie('token', staffJwt);
    const staffState = JSON.stringify({ 
      tenant: "{\"role\":\"staff\",\"tenantId\":\"tenant123\"}",
      user: "{\"userDetails\":{\"role\":\"staff\"}}" 
    });
    cy.window().then((win) => win.localStorage.setItem('persist:root', staffState));

    cy.intercept('GET', '**/api/**', { statusCode: 200, body: {} });
    cy.intercept('GET', '**/api/auth/getLogin', { 
      statusCode: 200, body: { user: { role: 'staff', tenant_id: 'tenant123' } } 
    });

    cy.visit('/dashboard');

    // 1. Verify Common Features exist for Staff too
    cy.contains('Orders').should('be.visible');
    cy.contains('Expenses').should('be.visible');
    cy.contains('Products').should('be.visible');

    // 2. Verify Admin Features are HIDDEN
    cy.contains('Devices').should('not.exist');
    cy.get('select.form-select option[value="all"]').should('not.exist');
  });

it('Staff user -> Direct URL access to Admin route -> Shows Access Popup', () => {
    // 1. Set up as Staff
    cy.setCookie('token', staffJwt);
    const staffState = JSON.stringify({ 
      tenant: "{\"role\":\"staff\",\"tenantId\":\"tenant123\"}",
      user: "{\"userDetails\":{\"role\":\"staff\"}}" 
    });
    cy.window().then((win) => win.localStorage.setItem('persist:root', staffState));

    // 2. Advanced Intercept: Let login pass, but block other Admin API calls with 403
    cy.intercept('GET', '**/api/**', (req) => {
      if (req.url.includes('/auth/getLogin')) {
        req.reply({ statusCode: 200, body: { user: { role: 'staff', tenant_id: 'tenant123' } } });
      } else {
        // Any data fetching on the branch-devices page gets rejected!
        req.reply({ statusCode: 403, body: { message: 'Admin access only' } });
      }
    });

    // 3. Staff tries to visit the Admin URL directly
    cy.visit('/branch-devices');

    // 4. ASSERTION: Instead of a redirect, we assert that your 'handleForbidden' 
    // event fired and the popup is displayed on the screen!
    cy.contains(/admin access only/i).should('be.visible');
  });
});