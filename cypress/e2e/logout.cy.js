describe('2. LOGOUT FLOW', () => {
  
  beforeEach(() => {
    // 1. Force the app into a "logged in" state by injecting Redux data
    const fakeReduxState = JSON.stringify({
      tenant: "{\"tenantId\":\"tenant123\",\"role\":\"admin\",\"userId\":1}"
    });
    
    cy.window().then((win) => {
      win.localStorage.setItem('persist:root', fakeReduxState);
      win.sessionStorage.setItem('authToken', 'fake-jwt-token'); 
    });

    // 2. Shield the dashboard APIs
    cy.intercept('GET', '**/api/**', { statusCode: 200, body: {} });
  });

  it('Logout flow works, clears data, and redirects to login', () => {
    // 1. Mock the logout API call so it doesn't hit your real backend
    cy.intercept('POST', '**/api/auth/logout', { 
      statusCode: 200, 
      message: 'Logged out successfully' 
    }).as('logoutReq');

    // 2. Visit the logout route directly. This triggers your Logout.js component!
    cy.visit('/logout');

    // 3. Wait for your component's useEffect to call the logout API
    cy.wait('@logoutReq');

    // 4. Verify your navigate('/') pushed the user back to the home/login page
    cy.location('pathname').should('eq', '/');

    // 5. Verify your component cleared the Redux persist:root data
    cy.window().then((win) => {
      const localData = win.localStorage.getItem('persist:root');
      if (localData) {
        expect(localData).not.to.include('tenant123');
      } else {
        expect(localData).to.be.null;
      }
      
      // Also verify it cleared the token from cookies (as per your code)
      expect(win.document.cookie).not.to.include('token=');
    });
  });

it('Access protected route after logout -> blocked', () => {
    // 1. Manually wipe out all storage so the app knows we are logged out
    cy.clearLocalStorage();
    cy.clearAllSessionStorage();
    cy.clearCookies();

    // 2. CRITICAL FIX: We must override the beforeEach shield.
    // When the dashboard tries to verify the user, we force a 401 Unauthorized response.
    cy.intercept('GET', '**/api/auth/getLogin', { 
      statusCode: 401,
      body: { message: 'Unauthorized' }
    }).as('sessionCheck');

    // 3. Try to aggressively navigate directly to the dashboard
    cy.visit('/dashboard');

    // 4. Your app should see the empty storage and the 401 error, 
    // and immediately kick the user back to the login page (/)
    cy.location('pathname').should('eq', '/');
  });
});