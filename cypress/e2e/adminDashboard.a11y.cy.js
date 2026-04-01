describe('Admin Dashboard - accessibility smoke', () => {
  const apiBase = Cypress.env('apiUrl') || 'http://localhost:5000/api';

  const stubDashboardCalls = () => {
    cy.intercept('GET', `${apiBase}/dashboard?*`, { fixture: 'dashboard/basicOverview.json' }).as('getBasic');
    cy.intercept('GET', `${apiBase}/dashboard/locations-list*`, { fixture: 'dashboard/locations.json' }).as('getLocations');
  };

  beforeEach(() => {
    stubDashboardCalls();
    cy.login();
    cy.visit('/dashboard');
    cy.injectAxe();
  });

  it('overview has no serious a11y violations', () => {
    cy.wait('@getBasic');
    cy.checkA11y('#overview', {
      includedImpacts: ['serious', 'critical']
    });
  });
});

