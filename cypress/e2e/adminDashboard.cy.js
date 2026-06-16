describe('Admin Dashboard - happy path UI + API checks', () => {
  const adminJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_signature';

  const stubDashboardCalls = () => {
    cy.intercept('GET', '**/api/**/dashboard?*', { fixture: 'dashboard/basicOverview.json' }).as('getBasic');
    cy.intercept('GET', '**/api/**/locations-list*', { fixture: 'dashboard/locations.json' }).as('getLocations');
    cy.intercept('GET', '**/api/**/revenue-overview*', { fixture: 'dashboard/revenueOverview.json' }).as('getRevenueOverview');
    cy.intercept('GET', '**/api/**/growth-comparison*', {
      body: {
        current_period: { revenue: 200000, profit: 55000, orders: 320 },
        growth: { revenue_growth_percent: 5.25, profit_growth_percent: 3.1, orders_growth_percent: 2.0 }
      }
    }).as('getGrowthComparison');
    cy.intercept('GET', '**/api/**/sales-trend*', { fixture: 'dashboard/salesTrend.json' }).as('getSalesTrend');
    cy.intercept('GET', '**/api/**/category-performance*', { fixture: 'dashboard/categoryPerformance.json' }).as('getCategoryPerformance');
    cy.intercept('GET', '**/api/**/location-performance*', { fixture: 'dashboard/locationPerformance.json' }).as('getLocationPerformance');
    cy.intercept('GET', '**/api/**/inventory-intelligence*', { fixture: 'dashboard/inventoryIntelligence.json' }).as('getInventoryIntelligence');
    cy.intercept('GET', '**/api/**/customer-credit*', { fixture: 'dashboard/customerCredit.json' }).as('getCustomerCredit');
  };

  beforeEach(() => {
    cy.viewport(1280, 800);
    Cypress.on('uncaught:exception', () => false);

    cy.setCookie('token', adminJwt);
    
    // 1. The exact flags needed to unlock the UI
    const unlockFlags = {
      advanced_reports: true,
      analytical_reports: true,
      plan_features: { advanced_reports: true, analytical_reports: true }
    };

    const adminState = JSON.stringify({ 
      tenant: JSON.stringify({
        role: "admin",
        tenantId: "tenant123",
        tenantConfig: unlockFlags
      }),
      user: JSON.stringify({ userDetails: { role: "admin", id: 1 } }) 
    });

    // 2. The Super Payload
    const superResponse = {
      success: true,
      data: {
        user: { role: 'admin', tenant_id: 'tenant123', id: 1 },
        tenant: { role: 'admin', tenantId: 'tenant123', tenantConfig: unlockFlags },
        tenantConfig: unlockFlags,
        plan_features: unlockFlags,
        ...unlockFlags
      }
    };

    // 3. Catch ALL the config routes (including the sneaky /tenant/me)
    cy.intercept('GET', '**/api/auth/getLogin*', { statusCode: 200, body: superResponse }).as('getLogin');
    cy.intercept('GET', '**/api/settings*', { statusCode: 200, body: superResponse }).as('getSettings');
    cy.intercept('GET', '**/api/platform/config*', { statusCode: 200, body: superResponse }).as('getConfig');
    cy.intercept('GET', '**/api/tenant/me*', { statusCode: 200, body: superResponse }).as('getTenantMe');

    stubDashboardCalls();
    
    // 4. Visit the page normally so Auth doesn't crash
    cy.visit('/dashboard');

    // 5. Inject LocalStorage into the stable window
    cy.window().then((win) => {
      win.localStorage.setItem('persist:root', adminState);
    });

    // 6. Hard reload to force React to read the new premium LocalStorage
    cy.reload();

    cy.wait('@getBasic');
    cy.wait(1500); // Give React 1.5 seconds to unlock the buttons
  });

  it('loads overview with basic cards and filters', () => {
    cy.get('.dashboard-v2').should('exist');
    cy.get('#range-select').should('exist');
    cy.get('#location-select').should('exist');
    cy.get('#overview').within(() => {
      cy.contains('h3', 'Overview', { matchCase: false }).should('exist');
      cy.get('.stat-card').should('have.length.greaterThan', 3);
    });
  });

  it('changes range and sends correct query params', () => {
    cy.intercept('GET', '**/api/**/dashboard?*').as('rangeCall');
    cy.get('#range-select').select('Last 30 Days', { force: true });
    cy.wait('@rangeCall').then((interception) => {
      expect(interception.request.url.toLowerCase()).to.contain('last_30_days');
    });
  });

  it('navigates sidebar sections and verifies API calls + UI', () => {
    
    const clickSidebar = (text) => {
      cy.get('.dashboard-sidebar')
        .contains('button', text, { matchCase: false })
        .scrollIntoView()
        .should('be.visible')
        // The lock is officially gone!
        .should('not.have.class', 'locked')
        .click(); 
    };

    clickSidebar('Revenue Overview');
    cy.wait('@getRevenueOverview');
    cy.get('#revenue-overview .stat-card').should('have.length.at.least', 4);

    clickSidebar('Growth & Comparison');
    cy.wait('@getGrowthComparison');
    cy.get('#growth-comparison .stat-card, #growth-comparison .growth-card').should('have.length.at.least', 1);

    clickSidebar('Sales Trend');
    cy.wait('@getSalesTrend');
    cy.get('#sales-trend canvas, #sales-trend .empty-state').should('exist');
    
    cy.get('#sales-trend').contains('button', 'By Location').click();
    cy.wait('@getSalesTrend');

    clickSidebar('Category & Top Products');
    cy.wait('@getCategoryPerformance');
    cy.get('#category-products .pie-card, #category-products canvas').should('exist');
    
    cy.get('#category-products .tab-switch').contains('button', 'Top by Revenue').click();

    clickSidebar('Location Performance');
    cy.wait('@getLocationPerformance');
    cy.get('#location-performance table tbody tr').should('have.length.at.least', 1);

    clickSidebar('Inventory Intelligence');
    cy.wait('@getInventoryIntelligence');
    cy.get('#inventory-intelligence .stat-card').should('have.length.at.least', 1);

    clickSidebar('Customer & Credit');
    cy.wait('@getCustomerCredit');
    cy.get('#customer-credit table tbody tr').should('have.length.at.least', 1);
  });

  it('filters by location and propagates to requests', () => {
    cy.intercept('GET', '**/api/**/dashboard?*').as('locationCall');
    cy.get('#location-select').select('Hyderabad', { force: true });
    cy.wait('@locationCall').then((interception) => {
      expect(interception.request.url.toLowerCase()).to.contain('hyderabad');
    });
  });
});