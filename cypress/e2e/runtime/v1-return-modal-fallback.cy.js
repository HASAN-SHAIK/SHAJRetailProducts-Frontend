describe('V1 return modal loaded-row fallback runtime', () => {
  const order = {
    id: 7001,
    transaction_type: 'sale',
    status: 'completed',
    payment_status: 'paid',
    payment_method: 'cash',
    total_amount: 240,
    total_paid: 240,
    balance: 0,
    created_at: '2026-09-04T12:00:00Z',
    items: [
      {
        id: 9001,
        order_item_id: 9001,
        product_id: 501,
        product_name: 'Runtime Return Tea',
        quantity: 2,
        returned_quantity: 0,
        selling_price: 120,
        line_total: 240,
      },
    ],
    payment_history: [{ id: 1, amount: 240, status: 'paid', direction: 'in' }],
  };

  beforeEach(() => {
    cy.intercept({ method: /GET|POST|PUT|DELETE/, url: '**/api/**' }, { statusCode: 200, body: {} });
    cy.intercept('GET', '**/auth/getLogin', {
      statusCode: 200,
      body: { user: { id: 'return-runtime-user', tenant_id: 'tenant-1', role: 'admin', all_branch_access: true } },
    });
    cy.intercept('GET', '**/tenant/me', { statusCode: 200, body: { subscription_status: 'active' } });
    cy.intercept('GET', '**/branches**', { statusCode: 200, body: { branches: [] } });
    cy.intercept('GET', '**/settings**', { statusCode: 200, body: {} });
    cy.intercept('GET', '**/v1/sales*', {
      statusCode: 200,
      body: { orders: [order], pagination: { page: 1, limit: 200, total_pages: 1, total_records: 1 } },
    }).as('salesList');
    cy.intercept('GET', '**/v1/sales/7001', { statusCode: 500, body: { error: 'runtime_detail_unavailable' } }).as('v1DetailFail');
    cy.intercept('GET', '**/orders/7001', { statusCode: 500, body: { error: 'runtime_detail_unavailable' } }).as('legacyDetailFail');
  });

  it('opens Return Products from loaded row when both detail endpoints fail', () => {
    cy.visit('/orders');
    cy.wait('@salesList');

    cy.contains('td', 'Runtime Return Tea', { timeout: 20000 }).should('be.visible');
    cy.contains('tr', '#7001').within(() => {
      cy.contains('button', /^Return$/).click();
    });

    cy.wait('@v1DetailFail');
    cy.wait('@legacyDetailFail');

    cy.contains('h4', 'Return Products').should('be.visible');
    cy.get('.return-error').should('not.exist');
    cy.get('.return-table').within(() => {
      cy.contains('td', 'Runtime Return Tea').should('be.visible');
      cy.contains('td', '2').should('be.visible');
      cy.get('input[type="number"]').should('have.attr', 'max', '2').clear().type('1');
    });
    cy.contains('.return-total', 'Items Refund').should('contain.text', '120');
    cy.contains('button', 'Process Return').should('be.enabled');

    cy.log('V1_RETURN_DETAIL_ENDPOINTS_FAILED=true');
    cy.log('V1_RETURN_LOADED_ROW_FALLBACK_RENDERED=true');
  });
});
