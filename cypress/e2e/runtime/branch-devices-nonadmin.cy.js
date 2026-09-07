describe('Cycle C branch-devices non-admin authority runtime', () => {
  let deviceReads = 0;

  beforeEach(() => {
    deviceReads = 0;
    cy.intercept({ method: /GET|POST|PATCH/, url: '**/api/**' }, { statusCode: 200, body: {} });
    cy.intercept('GET', '**/auth/getLogin', {
      statusCode: 200,
      body: { user: { id: 'cycle-c-user', tenant_id: 'tenant-1', role: 'manager', all_branch_access: false, branch_id: 'branch-1', user_name: 'Cycle C Manager' } },
    }).as('auth');
    cy.intercept('GET', '**/tenant/me', {
      statusCode: 200,
      body: { subscription_status: 'active', reports_enabled: true, mobile_access: false },
    });
    cy.intercept('GET', '**/branches', {
      statusCode: 200,
      body: { branches: [{ id: 'branch-1', branch_id: 'branch-1', name: 'Cycle C Branch', store_number: 'STORE-01' }] },
    }).as('branches');
    cy.intercept('GET', '**/settings**', { statusCode: 200, body: { is_opening_completed: true } });
    cy.intercept('GET', '**/banner**', { statusCode: 200, body: { show_banner: false } });
    cy.intercept('GET', '**/branches/branch-1/devices', (req) => {
      deviceReads += 1;
      req.reply({ statusCode: 200, body: { devices: [{ id: 'hidden-device', device_id: 'SECRET-DEVICE', is_active: true }], active_count: 1, branch: { subscription_plan: 'pro', resolved_limit: 5 } } });
    }).as('deviceRead');
  });

  it('renders the admin-only boundary without requesting Central device inventory', () => {
    cy.visit('/branch-devices', {
      onBeforeLoad(win) {
        win.localStorage.setItem('selected_branch_id', 'branch-1');
        win.localStorage.setItem('selected_branch_confirmed', '1');
        win.localStorage.setItem('selected_branch_name', 'Cycle C Branch');
      },
    });
    cy.wait('@auth');
    cy.contains('Admin access only.', { timeout: 15000 }).should('be.visible');
    cy.contains('SECRET-DEVICE').should('not.exist');
    cy.wait(1500).then(() => {
      expect(deviceReads, 'non-admin Central device inventory reads').to.eq(0);
      cy.log(`CYCLE_C_BRANCH_DEVICES_NONADMIN_DEVICE_READS=${deviceReads}`);
      cy.log('CYCLE_C_BRANCH_DEVICES_NONADMIN_RUNTIME_PASS=true');
    });
  });
});
