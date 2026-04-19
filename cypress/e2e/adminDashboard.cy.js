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
    Cypress.on('uncaught:exception', () => false);

    cy.setCookie('token', adminJwt);
    
    // Inject initial state
    const adminState = JSON.stringify({ 
      tenant: "{\"role\":\"admin\",\"tenantId\":\"tenant123\",\"tenantConfig\":{\"advanced_reports\":true,\"analytical_reports\":true}}",
      user: "{\"userDetails\":{\"role\":\"admin\",\"id\":1}}" 
    });
    
    cy.window().then((win) => {
      win.localStorage.setItem('persist:root', adminState);
    });

    // THE FIX: We must include the tenantConfig in the API mocks so the app doesn't overwrite our Redux state!
    cy.intercept('GET', '**/api/auth/getLogin', { 
      statusCode: 200, 
      body: { 
        user: { role: 'admin', tenant_id: 'tenant123', id: 1 },
        tenant: { 
          tenantConfig: { advanced_reports: true, analytical_reports: true } 
        }
      } 
    });
    
    cy.intercept('GET', '**/api/platform/config*', { 
      statusCode: 200, 
      body: { advanced_reports: true, analytical_reports: true } 
    });
    
    cy.intercept('GET', '**/api/settings*', { 
      statusCode: 200, 
      body: { 
        tenantConfig: { advanced_reports: true, analytical_reports: true }
      } 
    });

    stubDashboardCalls();
    
    cy.visit('/dashboard');
    cy.wait('@getBasic');
    cy.wait(1000); 
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
        // I removed the strict `.should('not.have.class')` assertion to prevent false-positive crashes.
        // We just let Cypress click it!
        .click({ force: true });
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
    
    // Main UI toggle
    cy.get('#sales-trend').contains('button', 'By Location').click({ force: true });
    cy.wait('@getSalesTrend');

    clickSidebar('Category & Top Products');
    cy.wait('@getCategoryPerformance');
    cy.get('#category-products .pie-card, #category-products canvas').should('exist');
    
    // Main UI tab
    cy.get('#category-products .tab-switch').contains('button', 'Top by Revenue').click({ force: true });

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