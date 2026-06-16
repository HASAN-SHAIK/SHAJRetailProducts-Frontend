describe('12. ROUTING TESTS', () => {

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
    Cypress.on('uncaught:exception', () => false);
  });

  // ==========================================
  // ❗ INVALID ROUTE (FINAL - STABLE)
  // ==========================================
  it('Invalid route → should redirect to home (current behavior)', () => {

    cy.visit('/some-random-route-xyz');

    // 🔥 Wait for redirect to complete
    cy.location('pathname', { timeout: 10000 }).should('eq', '/');

    // UI should be visible (app loaded)
    cy.get('body').should('be.visible');
  });

  // ==========================================
  // 🔐 PROTECTED ROUTE (NO LOGIN)
  // ==========================================
  it('Protected route → should block access when not logged in', () => {

    cy.visit('/dashboard');

    cy.location('pathname', { timeout: 10000 })
      .should('not.eq', '/dashboard');

    cy.get('input[type="password"]', { timeout: 10000 })
      .should('exist');
  });

  // ==========================================
  // 🔓 PROTECTED ROUTE (WITH LOGIN)
  // ==========================================
  it('Protected route → should allow access when logged in', () => {

    cy.setCookie('token', 'dummy_token');

    cy.visit('/dashboard');

    cy.location('pathname').should('include', '/dashboard');

    cy.get('body').should('be.visible');
  });

  // ==========================================
  // 🔄 BACK / FORWARD
  // ==========================================
  it('Back/Forward navigation should work correctly', () => {

    cy.setCookie('token', 'dummy_token');

    cy.visit('/dashboard');
    cy.visit('/neworder');

    cy.go('back');
    cy.location('pathname').should('include', '/dashboard');

    cy.go('forward');
    cy.location('pathname').should('include', '/neworder');
  });

  // ==========================================
  // 🔁 REFRESH
  // ==========================================
  it('Page refresh should retain route when logged in', () => {

    cy.setCookie('token', 'dummy_token');

    cy.visit('/dashboard');

    cy.reload();

    cy.location('pathname').should('include', '/dashboard');
  });

});