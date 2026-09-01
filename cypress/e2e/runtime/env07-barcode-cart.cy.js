describe('ENV-07 barcode scanner to POS/cart runtime', () => {
  const barcode = '8901234567890';
  const product = {
    id: 'env07-product-1', product_id: 'env07-product-1', name: 'ENV07 Runtime Milk', product_name: 'ENV07 Runtime Milk',
    barcode, selling_price: 42, mrp: 45, gst_percentage: 5, stock_quantity: 10, branch_id: 'branch-1', is_batch_enabled: false, is_weight_based: false,
  };

  beforeEach(() => {
    cy.intercept({ method: /GET|POST/, url: '**/api/**' }, { statusCode: 200, body: {} });
    cy.intercept('GET', '**/auth/getLogin', {
      statusCode: 200,
      body: { user: { id: 'env07-user', tenant_id: 'tenant-1', role: 'admin', all_branch_access: true } },
    }).as('auth');
    cy.intercept('GET', '**/tenant/me', {
      statusCode: 200,
      body: { enable_barcode: true, subscription_status: 'active', reports_enabled: true, gst_mode: 'INCLUSIVE' },
    }).as('tenant');
    cy.intercept('GET', '**/branches**', { statusCode: 200, body: { branches: [{ id: 'branch-1', name: 'ENV07 Branch' }] } }).as('branches');
    cy.intercept('GET', '**/settings**', { statusCode: 200, body: {} });
    cy.intercept('GET', '**/banner**', { statusCode: 200, body: { show_banner: false } });
    cy.intercept('GET', `**/products/barcode/sale?barcode=${barcode}`, { statusCode: 200, body: { product } }).as('barcodeLookup');
    cy.intercept('GET', '**/products/search/sale**', { statusCode: 200, body: { products: [product] } });
  });

  it('simulates a keyboard-wedge scanner and adds the looked-up product to the live cart', () => {
    cy.visit('/billing/retail');
    cy.get('input[placeholder="Scan or type barcode"]', { timeout: 20000 })
      .should('be.visible')
      .then(($input) => {
        const input = $input[0];
        const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        input.focus();
        nativeSetter.call(input, barcode);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', code: 'Enter', bubbles: true, cancelable: true,
        }));
      });
    cy.wait('@barcodeLookup');
    cy.contains('ENV07 Runtime Milk', { timeout: 10000 }).should('be.visible');
    cy.get('input[placeholder="Scan or type barcode"]').should('have.value', '').and('be.focused');
    cy.log('ENV07_VIRTUAL_HID=true');
    cy.log('ENV07_BARCODE_LOOKUP=true');
    cy.log('ENV07_CART_MUTATION=true');
    cy.log('ENV07_RUNTIME_PASS=true');
  });
});
