describe('Products Page - End-to-End Tests', () => {
  const adminJwt =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJyb2xlIjoiYWRtaW4iLCJ0ZW5hbnRfaWQiOiJ0ZW5hbnQxMjMifQ.dummy_signature';

  const tenantConfig = {
    receipt_module_enabled: true,
    GST_invoice_enabled: true,
    CUSTOMER_MODULE: true,
    advanced_reports: true,
    analytical_reports: true,
    enable_piece_based: true,
    enable_weight_based: true,
    plan_features: {
      receipt_module_enabled: true,
      GST_invoice_enabled: true,
      enable_piece_based: true,
      enable_weight_based: true,
    },
  };

  const authResponse = {
    success: true,
    token: adminJwt,
    user: {
      role: 'admin',
      tenant_id: 'tenant123',
      id: 1,
      email: 'admin@srh.com',
    },
    tenant: {
      role: 'admin',
      tenantId: 'tenant123',
      tenantConfig,
    },
    tenantConfig,
  };

  const seedProducts = [
    {
      id: 101,
      product_name: 'Alpha Charger',
      name: 'Alpha Charger',
      company: 'VoltWorks',
      category: 'Electronics',
      barcode: 'BAR-101',
      selling_price: 200,
      purchase_price: 150,
      mrp: 220,
      stock_quantity: 10,
      gst_percentage: 18,
      is_weight_based: '0',
      created_at: '2026-04-20T10:00:00.000Z',
      updated_at: '2026-04-20T10:00:00.000Z',
    },
    {
      id: 102,
      product_name: 'Berry Juice',
      name: 'Berry Juice',
      company: 'FreshCo',
      category: 'Beverages',
      barcode: 'BAR-102',
      selling_price: 90,
      purchase_price: 60,
      mrp: 100,
      stock_quantity: 25,
      gst_percentage: 12,
      is_weight_based: '0',
      created_at: '2026-04-20T11:00:00.000Z',
      updated_at: '2026-04-20T11:00:00.000Z',
    },
    {
      id: 103,
      product_name: 'Zulu Speaker',
      name: 'Zulu Speaker',
      company: 'SoundLab',
      category: 'Electronics',
      barcode: 'BAR-103',
      selling_price: 500,
      purchase_price: 350,
      mrp: 550,
      stock_quantity: 4,
      gst_percentage: 18,
      is_weight_based: '0',
      created_at: '2026-04-20T12:00:00.000Z',
      updated_at: '2026-04-20T12:00:00.000Z',
    },
  ];

  const buildPersistedState = () =>
    JSON.stringify({
      tenant: JSON.stringify({
        role: 'admin',
        tenantId: 'tenant123',
        tenantConfig,
        configStatus: 'loaded',
      }),
      user: JSON.stringify({
        userDetails: {
          role: 'admin',
          id: 1,
          tenant_id: 'tenant123',
          email: 'admin@srh.com',
        },
      }),
    });

  const setupCatalogPage = () => {
    cy.viewport(1280, 800);
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.clearAllSessionStorage();
    Cypress.on('uncaught:exception', () => false);

    cy.intercept('GET', '**/api/auth/getLogin*', {
      statusCode: 200,
      body: authResponse,
    }).as('getLogin');

    cy.intercept('GET', '**/api/tenant/me*', {
      statusCode: 200,
      body: {
        data: {
          ...tenantConfig,
          subscription_status: 'active',
        },
      },
    }).as('tenantMe');

    cy.intercept('GET', '**/api/settings*', {
      statusCode: 200,
      body: {
        whatsapp_bill_enabled: false,
      },
    }).as('settings');

    cy.intercept('GET', '**/api/branches*', {
      statusCode: 200,
      body: { data: [] },
    }).as('branches');

    cy.intercept('GET', '**/api/banner*', {
      statusCode: 200,
      body: {
        data: {
          show_banner: false,
          days_left: 30,
        },
      },
    }).as('banner');

    cy.intercept('GET', '**/api/orders/getcategories*', {
      statusCode: 200,
      body: {
        categories: ['Electronics', 'Beverages'],
      },
    }).as('getCategories');

    cy.intercept('GET', '**/hsn/search**', {
      statusCode: 200,
      body: {
        data: [],
      },
    }).as('hsnSearch');

    cy.intercept('GET', '**/hsn/lookup**', {
      statusCode: 200,
      body: {
        data: null,
      },
    }).as('hsnLookup');

    cy.intercept('GET', '**/api/sync/products*', {
      statusCode: 200,
      body: {
        success: true,
        data: seedProducts,
        deleted_ids: [],
        server_time: '2026-04-21T10:00:00.000Z',
      },
    }).as('syncProducts');

    cy.intercept('GET', '**/api/sync/batches*', {
      statusCode: 200,
      body: {
        success: true,
        data: [],
        deleted_ids: [],
        server_time: '2026-04-21T10:00:00.000Z',
      },
    }).as('syncBatches');

    cy.intercept('GET', '**/api/sync/suppliers*', {
      statusCode: 200,
      body: {
        success: true,
        data: [],
        deleted_ids: [],
        server_time: '2026-04-21T10:00:00.000Z',
      },
    }).as('syncSuppliers');

    cy.intercept('POST', '**/api/products/extra-details', {
      statusCode: 200,
      body: {
        products: [],
      },
    }).as('extraDetails');

    cy.intercept('POST', '**/api/products', (req) => {
      const body = req.body || {};
      req.reply({
        statusCode: 201,
        body: {
          product: {
            id: 999,
            product_name: body.product_name,
            name: body.product_name,
            company: body.company,
            category: body.category,
            barcode: body.barcode || 'BAR-999',
            selling_price: body.selling_price,
            purchase_price: body.purchase_price,
            mrp: body.mrp,
            stock_quantity: body.stock_quantity,
            gst_percentage: body.gst_percentage,
            is_weight_based: body.is_weight_based,
            created_at: '2026-04-21T10:05:00.000Z',
            updated_at: '2026-04-21T10:05:00.000Z',
          },
        },
      });
    }).as('createProduct');

    cy.visit('/', {
      onBeforeLoad(win) {
        win.indexedDB.deleteDatabase('shajretaildb');
        win.localStorage.clear();
        win.localStorage.setItem('persist:root', buildPersistedState());
        win.localStorage.setItem('auth_token', adminJwt);
        win.localStorage.setItem('selected_branch_id', 'all');
      },
    });

    cy.window().then((win) => {
      win.history.pushState({}, '', '/inventory/catalog');
      win.dispatchEvent(new win.PopStateEvent('popstate'));
    });

    cy.url().should('include', '/inventory/catalog');
    cy.contains('Add Product').should('be.visible');
    cy.contains('Refresh from Server').click();

    cy.wait('@getCategories');
    cy.wait('@syncProducts');
    cy.wait('@syncBatches');
    cy.wait('@syncSuppliers');

    cy.contains('td', 'Alpha Charger', { timeout: 10000 }).should('exist');
    cy.contains('td', 'Berry Juice').should('exist');
    cy.contains('td', 'Zulu Speaker').should('exist');
  };

  beforeEach(() => {
    setupCatalogPage();
  });

  it('Add Product Successfully', () => {
    const productName = `TestProduct${Date.now()}`;

    cy.contains('Add Product').click();
    cy.get('#addProductModal').should('be.visible');

    cy.get('#product_name').clear().type(productName, { delay: 0 }).should('have.value', productName);
    cy.get('#company').type('TestCompany');
    cy.get('#category').type('Electronics');
    cy.get('#selling_price').type('200');
    cy.get('#purchase_price').type('150');
    cy.get('#mrp').type('220');
    cy.get('#stock_quantity').type('10');
    cy.get('#time_for_delivery').type('2');

    cy.get('#addProductModal').contains('button', 'Save').click();

    cy.wait('@createProduct').then(({ request, response }) => {
      expect(response?.statusCode).to.eq(201);
      expect(request.body.product_name).to.eq(productName);
      expect(request.body.company).to.eq('TestCompany');
      expect(request.body.category).to.eq('Electronics');
      expect(String(request.body.selling_price)).to.eq('200');
      expect(String(request.body.purchase_price)).to.eq('150');
      expect(String(request.body.mrp)).to.eq('220');
      expect(String(request.body.stock_quantity)).to.eq('10');
      expect(String(request.body.time_for_delivery)).to.eq('2');
    });
  });

  it('Search for a Product', () => {
    cy.get('input[placeholder="Search by product name or barcode"]').type('Berry');
    cy.contains('td', 'Berry Juice', { timeout: 10000 }).should('exist');
    cy.contains('td', 'Alpha Charger').should('not.exist');
  });

  it('Sort Products by Name', () => {
    cy.get('select.sort-select').select('Sort by Name');

    cy.get('table.products-table tbody .product-name-text')
      .then(($names) => {
        const names = [...$names].map((node) => node.innerText.trim()).filter(Boolean);
        const relevantNames = names.filter((name) =>
          ['Alpha Charger', 'Berry Juice', 'Zulu Speaker'].includes(name)
        );
        const ascending = ['Alpha Charger', 'Berry Juice', 'Zulu Speaker'];
        const descending = [...ascending].reverse();

        expect(relevantNames.slice(0, 3)).to.satisfy(
          (value) =>
            JSON.stringify(value) === JSON.stringify(ascending) ||
            JSON.stringify(value) === JSON.stringify(descending)
        );
      });
  });

  it('Filter Products by Category', () => {
    cy.get('select.category-select').select('Electronics');

    cy.contains('td', 'Alpha Charger', { timeout: 10000 }).should('exist');
    cy.contains('td', 'Zulu Speaker').should('exist');
    cy.contains('td', 'Berry Juice').should('not.exist');
  });
});
