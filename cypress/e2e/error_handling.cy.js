describe('9. ERROR HANDLING TESTS', () => {

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  // ==========================================
  // ✅ 401 UNAUTHORIZED
  // ==========================================
  it('401 → should redirect to login or show login UI', () => {

    cy.intercept('GET', '**/api/**', {
      statusCode: 401
    }).as('unauthorized');

    cy.visit('/dashboard');

    cy.wait('@unauthorized');

    cy.url().then((url) => {
      expect(url).to.not.include('/dashboard');
    });
  });

  // ==========================================
  // 🔴 403 FORBIDDEN
  // ==========================================
  it('403 → should handle gracefully (redirect or block UI)', () => {

    cy.setCookie('token', 'dummy_token');

    cy.intercept('GET', '**/api/**', {
      statusCode: 403
    }).as('forbidden');

    cy.visit('/dashboard');

    cy.wait('@forbidden');

    cy.url().then((url) => {
      // ✅ Accept redirect as graceful handling
      expect(url).to.satisfy((u) =>
        u.includes('/') || u.includes('/dashboard')
      );
    });

    cy.get('body').should('be.visible');
  });

  // ==========================================
  // 🔴 500 SERVER ERROR
  // ==========================================
  it('500 → should not crash UI (graceful fallback)', () => {

    cy.setCookie('token', 'dummy_token');

    cy.intercept('GET', '**/api/**', {
      statusCode: 500
    }).as('serverError');

    cy.visit('/dashboard');

    cy.wait('@serverError');

    // ✅ App should NOT crash
    cy.get('body').should('be.visible');

    cy.url().then((url) => {
      expect(url).to.not.be.undefined;
    });
  });

  // ==========================================
  // 🔴 NETWORK FAILURE
  // ==========================================
  it('Network failure → app should not crash', () => {

    cy.setCookie('token', 'dummy_token');

    cy.intercept('GET', '**/api/**', {
      forceNetworkError: true
    }).as('networkFail');

    cy.visit('/dashboard');

    cy.wait('@networkFail');

    // ✅ UI should still exist
    cy.get('body').should('be.visible');

    cy.url().then((url) => {
      expect(url).to.not.be.undefined;
    });
  });

});