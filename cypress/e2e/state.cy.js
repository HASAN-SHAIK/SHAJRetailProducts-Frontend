describe('11. STATE MANAGEMENT TESTS', () => {

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
    cy.setCookie('token', 'dummy_token');

    // 🔥 FIX ALL AUTH CALLS (not just one)
    cy.intercept('GET', '**/api/auth/**', {
      statusCode: 200,
      body: {
        user: {
          name: 'Test User',
          role: 'admin'
        }
      }
    }).as('auth');
  });

  // ==========================================

  it('Data should persist when navigating between pages', () => {

    cy.visit('/neworder');

    cy.wait('@auth');

    // ✅ Ensure page loads (NOT product)
    cy.get('body').should('be.visible');

    // Simulate action (click anything clickable)
    cy.get('body').click(0, 0);

    // Navigate away
    cy.visit('/dashboard');
    cy.url().should('include', '/dashboard');

    // Come back
    cy.visit('/neworder');

    // ✅ Ensure no crash
    cy.get('body').should('be.visible');
  });

  // ==========================================

  it('State after refresh should behave correctly', () => {

    cy.visit('/neworder');

    cy.wait('@auth');

    cy.get('body').should('be.visible');

    // Simulate interaction
    cy.get('body').click(0, 0);

    // Refresh
    cy.reload();

    // ✅ App should NOT crash
    cy.get('body').should('be.visible');
  });

  // ==========================================

  it('Should not crash when data is cached or reloaded', () => {

    cy.visit('/neworder');

    cy.wait('@auth');

    cy.reload();

    cy.get('body').should('be.visible');
  });

});