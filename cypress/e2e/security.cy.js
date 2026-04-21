describe('14. SECURITY-LIKE FRONTEND TESTS', () => {

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  // ==========================================

  it('Handles token tampering, expiry, and unauthorized access safely', () => {

    // 🔴 1. TOKEN TAMPERING
    cy.setCookie('token', 'fake_invalid_token');

    cy.visit('/dashboard');

    // Should NOT allow access
    cy.url().should('not.include', '/dashboard');

    cy.get('body').should('be.visible');

    // ==========================================

    // 🔴 2. EXPIRED TOKEN (simulate 401)
    cy.setCookie('token', 'expired_token');

    cy.intercept('GET', '**/api/**', {
      statusCode: 401,
      body: {}
    }).as('unauthorized');

    cy.visit('/dashboard');

    cy.wait('@unauthorized');

    // Should redirect OR stay safe
    cy.url().should('not.include', '/dashboard');

    cy.get('body').should('be.visible');

    // ==========================================

    // 🔴 3. FORBIDDEN ACCESS (403)
    cy.setCookie('token', 'valid_but_no_permission');

    cy.intercept('GET', '**/api/**', {
      statusCode: 403,
      body: {}
    }).as('forbidden');

    cy.visit('/dashboard');

    cy.wait('@forbidden');

    // Should NOT crash
    cy.get('body').should('be.visible');

    // ==========================================

    // 🔴 4. NETWORK FAILURE
    cy.setCookie('token', 'valid_token');

    cy.intercept('GET', '**/api/**', {
      forceNetworkError: true
    }).as('networkFail');

    cy.visit('/dashboard');

    cy.wait('@networkFail');

    // Should not crash
    cy.get('body').should('be.visible');

  });

});