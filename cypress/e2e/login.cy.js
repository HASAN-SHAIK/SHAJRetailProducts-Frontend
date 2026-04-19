describe('1. LOGIN FLOW (CORE)', () => {
  
  beforeEach(() => {
    cy.viewport(1280, 800);
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.clearAllSessionStorage();
    
    // THE FIX: Set the intercept BEFORE visiting the page!
    cy.intercept('GET', '**/api/platform/config*', {
      statusCode: 200,
      body: { data: { subscription_status: 'active' } }
    }).as('configReq');
    
    cy.visit('/login'); 
  });

  it('Valid login -> redirect to dashboard', () => {
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 200,
      body: { token: 'mock-jwt-token', user: { id: 1, role: 'admin' } }
    }).as('loginReq');

    cy.get('input[name="email"]').type('admin@siddu.com');
    cy.get('input[name="password"]').type('admin');
    cy.get('button.letsgo').click();

    // THE FIX: Only wait for the login request here. Config already fired on load!
    cy.wait('@loginReq');
    cy.url().should('include', '/dashboard');
  });

  it('Invalid login -> error message', () => {
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 401,
      body: { message: 'Invalid email or password' }
    }).as('loginFail');

    cy.get('input[name="email"]').type('wrong@example.com');
    cy.get('input[name="password"]').type('wrongpass');
    cy.get('button.letsgo').click();

    cy.wait('@loginFail');
    cy.get('.loginErrorMessage').should('be.visible').and('contain', 'Invalid');
  });

  it('Empty email/password (HTML5 Validation)', () => {
    cy.get('button.letsgo').click();
    cy.get('input[name="email"]:invalid').should('have.length', 1);
  });

  it('Invalid email format', () => {
    cy.get('input[name="email"]').type('not-an-email');
    cy.get('button.letsgo').click();
    cy.get('input[name="email"]:invalid').should('have.length', 1);
  });

  it('API returns 500 error', () => {
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 500,
      body: { message: 'Internal Server Error' }
    }).as('serverError');

    cy.get('input[name="email"]').type('admin@siddu.com');
    cy.get('input[name="password"]').type('admin');
    cy.get('button.letsgo').click();

    cy.wait('@serverError');
    cy.get('.loginErrorMessage').should('contain', 'Server');
  });

  it('Auto-login if token exists', () => {
    cy.window().then((win) => {
      win.sessionStorage.setItem('token', 'mock-jwt-token');
      win.sessionStorage.setItem('authToken', 'mock-jwt-token');
    });
    
    cy.visit('/dashboard'); 
    cy.url().should('include', '/dashboard');
  });

  it('User session stored securely after login', () => {
    const validFakeJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ0ZW5hbnRfaWQiOiJ0ZW5hbnQxMjMiLCJyb2xlIjoiYWRtaW4ifQ.dummy_signature';

    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 200,
      body: { token: validFakeJwt }
    }).as('loginReq');

    cy.intercept('GET', '**/api/**', { statusCode: 200, body: {} });

    cy.get('input[name="email"]').type('admin@siddu.com');
    cy.get('input[name="password"]').type('admin');
    cy.get('button.letsgo').click();

    cy.wait('@loginReq');
    cy.url().should('include', '/dashboard');

    cy.window().should((win) => {
      const localData = win.localStorage.getItem('persist:root');
      expect(localData).to.include('tenant123'); 
      expect(localData).to.include('admin');     
    });
  });
});