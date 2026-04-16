const apiUrl = Cypress.env('apiUrl');

const getCredentials = () => {
  const email = Cypress.env('email');
  const password = Cypress.env('password');
  if (!email || !password) {
    throw new Error('Missing credentials. Set CYPRESS_EMAIL and CYPRESS_PASSWORD.');
  }
  return { email, password };
};

const pickArray = (...candidates) => candidates.find((value) => Array.isArray(value)) || [];

const getFirstBranchId = (headers) =>
  cy
    .request({
      method: 'GET',
      url: `${apiUrl}/branches`,
      headers,
    })
    .then((res) => {
      const list = pickArray(
        res.body?.data?.branches,
        res.body?.branches,
        res.body?.data
      );
      if (!list.length) {
        throw new Error('No branches found for smoke test.');
      }
      return String(list[0].id);
    });

const ensureSupplier = (headers, branchId) =>
  cy
    .request({
      method: 'GET',
      url: `${apiUrl}/suppliers`,
      headers,
      qs: { branch_id: branchId, limit: 50 },
    })
    .then((res) => {
      const existing = pickArray(res.body?.data?.suppliers, res.body?.suppliers);
      if (existing.length) {
        return Number(existing[0].id);
      }

      const suffix = Date.now();
      return cy
        .request({
          method: 'POST',
          url: `${apiUrl}/suppliers`,
          headers,
          body: {
            name: `E2E Supplier ${suffix}`,
            mobile: `90000${String(suffix).slice(-5)}`,
            branch_id: branchId,
          },
        })
        .then((createRes) => Number(createRes.body?.data?.supplier?.id));
    });

const createProduct = (headers, branchId) => {
  const suffix = Date.now();
  const barcode = `E2E-FIFO-${suffix}`;
  return cy
    .request({
      method: 'POST',
      url: `${apiUrl}/products`,
      headers,
      body: {
        product_name: `E2E FIFO Product ${suffix}`,
        category: 'E2E',
        selling_price: 120,
        purchase_price: 80,
        stock_quantity: 0,
        company: 'E2E',
        barcode,
        branch_id: branchId,
      },
    })
    .then((res) => {
      const product =
        res.body?.data?.product ||
        res.body?.product ||
        res.body?.data ||
        {};
      return {
        productId: Number(product.id),
        suffix,
      };
    });
};

describe('Smoke - Critical E2E Flows', () => {
  before(() => {
    const { email, password } = getCredentials();
    cy.request({
      method: 'POST',
      url: `${apiUrl}/auth/login`,
      body: {
        email,
        password,
        device_id: 'cypress-smoke-device',
      },
    }).then((res) => {
      const token = res.body?.token;
      expect(token, 'tenant token').to.be.a('string').and.not.empty;
      cy.wrap({
        Authorization: `Bearer ${token}`,
      }).as('authHeaders');
    });
  });

  it('billing + purchase + batch FIFO flow', function () {
    const headers = this.authHeaders;
    let branchId;
    let supplierId;
    let productId;
    let batchOne;
    let batchTwo;

    getFirstBranchId(headers)
      .then((id) => {
        branchId = id;
        return ensureSupplier(headers, branchId);
      })
      .then((id) => {
        supplierId = id;
        return createProduct(headers, branchId);
      })
      .then(({ productId: createdProductId, suffix }) => {
        productId = createdProductId;
        batchOne = `E2E-B1-${suffix}`;
        batchTwo = `E2E-B2-${suffix}`;
        return cy.request({
          method: 'POST',
          url: `${apiUrl}/purchases`,
          headers,
          body: {
            supplier_id: supplierId,
            branch_id: branchId,
            payment_mode: 'cash',
            invoice_number: `E2E-INV-1-${suffix}`,
            items: [
              {
                product_id: productId,
                quantity: 5,
                purchase_price: 70,
                selling_price: 100,
                gst_percent: 0,
                batch_number: batchOne,
                expiry_date: '2099-12-31',
              },
            ],
          },
        });
      })
      .then(() =>
        cy.request({
          method: 'POST',
          url: `${apiUrl}/purchases`,
          headers,
          body: {
            supplier_id: supplierId,
            branch_id: branchId,
            payment_mode: 'cash',
            invoice_number: `E2E-INV-2-${Date.now()}`,
            items: [
              {
                product_id: productId,
                quantity: 5,
                purchase_price: 72,
                selling_price: 105,
                gst_percent: 0,
                batch_number: batchTwo,
                expiry_date: '2099-12-31',
              },
            ],
          },
        })
      )
      .then(() =>
        cy.request({
          method: 'POST',
          url: `${apiUrl}/orders`,
          headers,
          body: {
            transaction_type: 'sale',
            payment_method: 'cash',
            branch_id: branchId,
            customer_name: 'E2E FIFO Customer',
            customer_phone: '9999999999',
            location: 'E2E',
            products: [
              {
                product_id: productId,
                quantity: 6,
              },
            ],
          },
        })
      )
      .then((saleRes) => {
        expect(saleRes.status).to.eq(201);
        return cy.request({
          method: 'GET',
          url: `${apiUrl}/batches`,
          headers,
          qs: { branch_id: branchId },
        });
      })
      .then((batchesRes) => {
        const allBatches = pickArray(batchesRes.body?.batches, batchesRes.body?.data?.batches);
        const relevant = allBatches.filter((row) => Number(row.product_id) === Number(productId));
        const first = relevant.find((row) => String(row.batch_number) === String(batchOne));
        const second = relevant.find((row) => String(row.batch_number) === String(batchTwo));

        expect(first, 'first batch').to.exist;
        expect(second, 'second batch').to.exist;
        expect(Number(first.quantity_remaining)).to.eq(0);
        expect(Number(second.quantity_remaining)).to.eq(4);
      });
  });

  it('sync endpoints smoke', function () {
    const headers = this.authHeaders;
    cy.request({
      method: 'GET',
      url: `${apiUrl}/sync/products`,
      headers,
      qs: { limit: 20 },
    }).its('status').should('eq', 200);

    cy.request({
      method: 'GET',
      url: `${apiUrl}/sync/batches`,
      headers,
      qs: { limit: 20 },
    }).its('status').should('eq', 200);

    cy.request({
      method: 'GET',
      url: `${apiUrl}/sync/suppliers`,
      headers,
      qs: { limit: 20 },
    }).its('status').should('eq', 200);
  });

  it('outstanding endpoint smoke', function () {
    const headers = this.authHeaders;
    cy.request({
      method: 'GET',
      url: `${apiUrl}/accounts/outstanding`,
      headers,
      qs: { party_type: 'customer' },
    }).then((res) => {
      expect(res.status).to.eq(200);
      const rows = pickArray(res.body?.data?.rows, res.body?.rows);
      expect(rows).to.be.an('array');
    });
  });
});
