const apiUrl = Cypress.env('apiUrl');

const pickArray = (...candidates) => candidates.find((value) => Array.isArray(value)) || [];

const getFirstBranchId = (headers) =>
  cy
    .request({
      method: 'GET',
      url: `${apiUrl}/branches`,
      headers,
    })
    .then((res) => {
      const list = pickArray(res.body?.data?.branches, res.body?.branches, res.body?.data);
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
        .then((createRes) => {
          const id = Number(createRes.body?.data?.supplier?.id);
          if (id) cy.trackEntity('suppliers', id);
          return id;
        });
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
      const product = res.body?.data?.product || res.body?.product || res.body?.data || {};
      if (product?.id) {
        cy.trackEntity('products', product.id);
      }
      return {
        productId: Number(product.id),
        suffix,
      };
    });
};

describe('Smoke - Critical E2E Flows', () => {
  beforeEach(() => {
    cy.resetTrackedEntities();
    cy.apiAuthHeaders().as('authHeaders');
  });

  afterEach(function () {
    cy.cleanupTrackedEntities(this.authHeaders);
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
        const createdOrderId =
          saleRes.body?.data?.order?.id ||
          saleRes.body?.data?.id ||
          saleRes.body?.order?.id ||
          saleRes.body?.id;
        if (createdOrderId) {
          cy.trackEntity('orders', createdOrderId);
        }
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
