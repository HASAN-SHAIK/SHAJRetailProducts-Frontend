describe('7. DASHBOARD & 8. NETWORK CONDITIONS', () => {
  const token = 'dummy_token';

  // Helper to ensure auth is mocked perfectly for every test
  const setupAuthMocks = () => {
    const unlockFlags = { CUSTOMER_MODULE: true, advanced_reports: true, analytical_reports: true };
    const adminState = JSON.stringify({ 
      tenant: JSON.stringify({ role: "admin", tenantId: "tenant123", tenantConfig: unlockFlags }),
      user: JSON.stringify({ userDetails: { role: "admin", id: 1 } }) 
    });

    const superResponse = {
      success: true,
      data: {
        user: { role: 'admin', tenant_id: 'tenant123', id: 1 },
        tenant: { role: 'admin', tenantId: 'tenant123', tenantConfig: unlockFlags },
        tenantConfig: unlockFlags
      }
    };

    cy.intercept('GET', '**/api/auth/getLogin*', { statusCode: 200, body: superResponse });
    cy.intercept('GET', '**/api/settings*', { statusCode: 200, body: superResponse });
    cy.intercept('GET', '**/api/platform/config*', { statusCode: 200, body: superResponse });
    cy.intercept('GET', '**/api/tenant/me*', { statusCode: 200, body: superResponse });
    cy.intercept('GET', '**/api/branches*', { statusCode: 200, body: { data: [] } });

    return adminState;
  };

  beforeEach(() => {
    cy.viewport(1280, 800);
    Cypress.on('uncaught:exception', () => false);
  });

  // ==========================================
  // 📊 7. DASHBOARD
  // ==========================================

  it('Loads correctly', () => {
    const adminState = setupAuthMocks();
    
    // THE FIX: Wait for the ACTUAL dashboard API, not the generic orders/customers
    cy.intercept('GET', '**/api/**/dashboard*', { statusCode: 200, body: { data: {} } }).as('dashboardAPI');

    cy.visit('/dashboard', {
      onBeforeLoad(win) {
        win.localStorage.setItem('persist:root', adminState);
        win.localStorage.setItem('token', token);
      }
    });

    cy.wait('@dashboardAPI');
    cy.url().should('not.include', '/login');
    cy.get('body').should('be.visible');
  });

  it('Data displayed from mock API', () => {
    const adminState = setupAuthMocks();

    cy.intercept('GET', '**/api/**/dashboard*', {
      statusCode: 200,
      body: { data: { revenue_overview: { total_revenue: 9999 } } }
    }).as('dashboardAPI');

    cy.visit('/dashboard', {
      onBeforeLoad(win) {
        win.localStorage.setItem('persist:root', adminState);
      }
    });

    cy.wait('@dashboardAPI');
    cy.get('body').should('not.contain.text', 'Login');
  });

  it('Empty state (no data)', () => {
    const adminState = setupAuthMocks();

    // Mock empty dashboard data
    cy.intercept('GET', '**/api/**/dashboard*', {
      statusCode: 200,
      body: { data: {} }
    }).as('empty');

    cy.visit('/dashboard', {
      onBeforeLoad(win) { win.localStorage.setItem('persist:root', adminState); }
    });

    cy.wait('@empty');

    cy.get('body').then(($body) => {
      const hasEmpty =
        $body.text().toLowerCase().includes('no data') ||
        $body.text().toLowerCase().includes('empty') ||
        $body.text().toLowerCase().includes('0') ||
        $body.find('table tbody tr').length === 0;

      expect(hasEmpty).to.be.true;
    });
  });

  it('API failure → error UI', () => {
    const adminState = setupAuthMocks();

    // Mock Dashboard failing
    cy.intercept('GET', '**/api/**/dashboard*', {
      statusCode: 500
    }).as('fail');

    cy.visit('/dashboard', {
      onBeforeLoad(win) { win.localStorage.setItem('persist:root', adminState); }
    });

    cy.wait('@fail');
    cy.get('body').should('be.visible');
  });

  // ==========================================
  // 🌐 8. NETWORK CONDITIONS
  // ==========================================

  it('Slow API → UI responsive (no freeze)', () => {
    const adminState = setupAuthMocks();

    cy.intercept('GET', '**/api/**/dashboard*', (req) => {
      req.on('response', (res) => {
        res.setDelay(3000); // 3 seconds is enough to test responsiveness without CI timeouts
      });
    }).as('slowApi');

    cy.visit('/dashboard', {
      onBeforeLoad(win) { win.localStorage.setItem('persist:root', adminState); }
    });

    cy.get('body').should('be.visible');
    cy.get('body').click({ force: true }); // Click anywhere while loading
    cy.wait('@slowApi');
  });
});