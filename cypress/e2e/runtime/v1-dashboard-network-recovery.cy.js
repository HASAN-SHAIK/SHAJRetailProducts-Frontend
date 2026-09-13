describe('V1 dashboard local POS network recovery runtime', () => {
  const healthUrl = 'http://127.0.0.1:4782/api/v1/health';
  const diagnosticsUrl = 'http://127.0.0.1:4782/api/v1/diagnostics';

  beforeEach(() => {
    cy.intercept({ method: /GET|POST/, url: '**/api/**' }, { statusCode: 200, body: {} });
    cy.intercept('GET', '**/auth/getLogin', {
      statusCode: 200,
      body: { user: { id: 'network-runtime-user', tenant_id: 'tenant-1', role: 'admin', all_branch_access: true } },
    });
    cy.intercept('GET', '**/tenant/me', { statusCode: 200, body: { subscription_status: 'active' } });
    cy.intercept('GET', '**/branches**', { statusCode: 200, body: { branches: [] } });
    cy.intercept('GET', '**/settings**', { statusCode: 200, body: {} });

    cy.intercept('GET', healthUrl, { forceNetworkError: true }).as('healthDown');
    cy.intercept('GET', diagnosticsUrl, { forceNetworkError: true }).as('diagnosticsDown');
  });

  it('shows local POS loss and recovers through the real dashboard refresh path', () => {
    cy.visit('/dashboard', {
      onBeforeLoad(win) {
        win.__SHAJ_POS_LOCAL_API_TOKEN__ = 'runtime-machine-token';
        win.sessionStorage.setItem('pos_local_session_token', 'runtime-session-token');
      },
    });

    cy.contains('Store runtime', { timeout: 20000 }).should('be.visible');
    cy.contains('POSService is unavailable. Start the local service and retry.', { timeout: 10000 })
      .should('be.visible')
      .and('have.attr', 'role', 'alert');
    cy.contains('POSService').parent().should('contain.text', 'Attention');

    cy.intercept('GET', healthUrl, { statusCode: 200, body: { status: 'ok' } }).as('healthUp');
    cy.intercept('GET', diagnosticsUrl, {
      statusCode: 200,
      body: {
        outbox: { pending: 2, dead_letter: 1 },
        inbox: { failed: 3 },
        backup: { latest_at: '2026-09-05T00:00:00Z' },
      },
    }).as('diagnosticsUp');

    cy.contains('button', 'Refresh POS').click();
    cy.wait('@healthUp');
    cy.wait('@diagnosticsUp');

    cy.contains('POSService is unavailable. Start the local service and retry.').should('not.exist');
    cy.contains('POSService').parent().should('contain.text', 'Healthy');
    cy.contains('Pending sync events').parent().should('contain.text', '2');
    cy.contains('Dead-letter events').parent().should('contain.text', '1');
    cy.contains('Failed inbound events').parent().should('contain.text', '3');
    cy.contains('Latest reported POS backup: 2026-09-05T00:00:00Z').should('be.visible');

    cy.log('V1_NETWORK_LOSS_VIRTUAL_SIMULATION=true');
    cy.log('V1_DASHBOARD_RECOVERY_RUNTIME=true');
  });
});
