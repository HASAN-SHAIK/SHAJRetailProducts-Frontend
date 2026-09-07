describe('Cycle C logout dual-failure containment runtime', () => {
  let centralLogoutWrites = 0;
  let localLogoutWrites = 0;

  beforeEach(() => {
    centralLogoutWrites = 0;
    localLogoutWrites = 0;

    cy.intercept('POST', '**/api/auth/logout', (req) => {
      centralLogoutWrites += 1;
      req.reply({ statusCode: 500, body: { message: 'Central logout unavailable' } });
    }).as('centralLogout');

    cy.intercept('POST', '**/api/v1/auth/logout', (req) => {
      localLogoutWrites += 1;
      expect(req.headers['x-pos-local-token']).to.eq('cycle-c-machine-token');
      expect(req.headers['x-pos-session-token']).to.eq('cycle-c-pos-session');
      req.reply({ statusCode: 500, body: { error: 'local logout unavailable' } });
    }).as('localLogout');

    cy.intercept('GET', '**/api/auth/getLogin', {
      statusCode: 401,
      body: { message: 'Unauthorized' },
    });
  });

  it('clears reusable browser and POS session state even when both logout services fail', () => {
    cy.visit('/logout', {
      onBeforeLoad(win) {
        win.__SHAJ_POS_LOCAL_API_TOKEN__ = 'cycle-c-machine-token';
        win.localStorage.setItem('session_info', JSON.stringify({
          token: null,
          user: { id: 'cycle-c-user', role: 'admin', tenant_id: 'tenant-1' },
        }));
        win.localStorage.setItem('auth_token', 'legacy-access-token');
        win.sessionStorage.setItem('auth_token', 'legacy-session-token');
        win.sessionStorage.setItem('pos_local_session_token', 'cycle-c-pos-session');
        win.localStorage.setItem('pos_local_user_id', 'cycle-c-user');
        win.document.cookie = 'token=legacy-cookie-token; path=/';
        win.document.cookie = 'refresh_token=legacy-refresh-token; path=/';
      },
    });

    cy.wait('@centralLogout');
    cy.wait('@localLogout');

    cy.location('pathname', { timeout: 15000 }).should('eq', '/');

    cy.window().then((win) => {
      expect(win.localStorage.getItem('session_info')).to.eq(null);
      expect(win.localStorage.getItem('auth_token')).to.eq(null);
      expect(win.sessionStorage.getItem('auth_token')).to.eq(null);
      expect(win.sessionStorage.getItem('pos_local_session_token')).to.eq(null);
      expect(win.document.cookie).not.to.include('token=');
      expect(win.document.cookie).not.to.include('refresh_token=');
    });

    cy.then(() => {
      expect(centralLogoutWrites, 'Central logout writes').to.eq(1);
      expect(localLogoutWrites, 'POSService logout writes').to.eq(1);
      cy.log(`CYCLE_C_LOGOUT_CENTRAL_WRITES=${centralLogoutWrites}`);
      cy.log(`CYCLE_C_LOGOUT_LOCAL_WRITES=${localLogoutWrites}`);
      cy.log('CYCLE_C_LOGOUT_DUAL_FAILURE_RUNTIME_PASS=true');
    });
  });
});
