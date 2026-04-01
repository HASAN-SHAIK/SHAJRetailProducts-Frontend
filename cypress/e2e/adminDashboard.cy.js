describe('Admin Dashboard - happy path UI + API checks', () => {
  const apiBase = Cypress.env('apiUrl') || 'http://localhost:5000/api';

  const stubDashboardCalls = (opts = {}) => {
    const qs = opts.qs || 'range=this_month';
    cy.intercept('GET', `${apiBase}/dashboard?*`, {
      fixture: 'dashboard/basicOverview.json'
    }).as('getBasic');
    cy.intercept('GET', `${apiBase}/dashboard/locations-list*`, {
      fixture: 'dashboard/locations.json'
    }).as('getLocations');
    cy.intercept('GET', `${apiBase}/dashboard/revenue-overview?*`, {
      fixture: 'dashboard/revenueOverview.json'
    }).as('getRevenueOverview');
    cy.intercept('GET', `${apiBase}/dashboard/growth-comparison?*`, {
      body: {
        current_period: { revenue: 200000, profit: 55000, orders: 320 },
        growth: { revenue_growth_percent: 5.25, profit_growth_percent: 3.1, orders_growth_percent: 2.0 }
      }
    }).as('getGrowthComparison');
    cy.intercept('GET', `${apiBase}/dashboard/sales-trend?*`, {
      fixture: 'dashboard/salesTrend.json'
    }).as('getSalesTrend');
    cy.intercept('GET', `${apiBase}/dashboard/category-performance?*`, {
      fixture: 'dashboard/categoryPerformance.json'
    }).as('getCategoryPerformance');
    cy.intercept('GET', `${apiBase}/dashboard/location-performance?*`, {
      fixture: 'dashboard/locationPerformance.json'
    }).as('getLocationPerformance');
    cy.intercept('GET', `${apiBase}/dashboard/inventory-intelligence?*`, {
      fixture: 'dashboard/inventoryIntelligence.json'
    }).as('getInventoryIntelligence');
    cy.intercept('GET', `${apiBase}/dashboard/customer-credit?*`, {
      fixture: 'dashboard/customerCredit.json'
    }).as('getCustomerCredit');
  };

  beforeEach(() => {
    stubDashboardCalls();
    cy.login();
    cy.visit('/dashboard');
  });

  it('loads overview with basic cards and filters', () => {
    cy.get('.dashboard-v2').should('exist');
    cy.get('#range-select').should('be.visible').and('not.be.disabled');
    cy.get('#location-select').should('be.visible');
    cy.get('#overview').within(() => {
      cy.contains('h3', 'Overview').should('be.visible');
      cy.get('.stat-card').should('have.length.greaterThan', 3);
    });
    cy.wait('@getBasic').its('request.url').should('contain', 'range=this_month');
  });

  it('changes range and sends correct query params', () => {
    cy.get('#range-select').select('Last 30 Days');
    cy.wait(['@getBasic']).then((interception) => {
      const url = interception.request.url;
      expect(url).to.match(/range=last_30_days/);
    });
  });

  it('navigates sidebar sections and verifies API calls + UI', () => {
    // Revenue Overview
    cy.contains('button', 'Revenue Overview').click();
    cy.wait('@getRevenueOverview');
    cy.get('#revenue-overview .stat-card').should('have.length.at.least', 4);

    // Growth & Comparison
    cy.contains('button', 'Growth & Comparison').click();
    cy.wait('@getGrowthComparison');
    cy.get('#growth-comparison .stat-card.growth-card').should('have.length', 3);

    // Sales Trend
    cy.contains('button', 'Sales Trend').click();
    cy.wait('@getSalesTrend');
    cy.get('#sales-trend .chart-card').within(() => {
      cy.get('canvas, .empty-state').should('exist');
    });
    cy.contains('button', 'By Location').click();
    cy.wait('@getSalesTrend');

    // Category & Top Products
    cy.contains('button', 'Category & Top Products').click();
    cy.wait('@getCategoryPerformance');
    cy.get('#category-products .pie-card').should('exist');
    cy.contains('button', 'Top by Revenue').click();

    // Location Performance
    cy.contains('button', 'Location Performance').click();
    cy.wait('@getLocationPerformance');
    cy.get('#location-performance table tbody tr').should('have.length.at.least', 1);

    // Inventory Intelligence
    cy.contains('button', 'Inventory Intelligence').click();
    cy.wait('@getInventoryIntelligence');
    cy.get('#inventory-intelligence .stat-card').should('have.length.at.least', 3);

    // Customer & Credit
    cy.contains('button', 'Customer & Credit').click();
    cy.wait('@getCustomerCredit');
    cy.get('#customer-credit table tbody tr').should('have.length.at.least', 1);
  });

  it('filters by location and propagates to requests', () => {
    cy.wait('@getLocations');
    cy.get('#location-select').select('Hyderabad');
    // Any of the API re-fetches should include location param
    cy.wait('@getBasic').its('request.url').should('contain', 'location=Hyderabad');
  });
});

