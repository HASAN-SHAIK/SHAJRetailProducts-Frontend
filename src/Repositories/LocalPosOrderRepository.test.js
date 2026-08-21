describe('LocalPosOrderRepository checkout write authority', () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  test('does not fall back to central order creation when local POS write fails', async () => {
    const centralCreate = jest.fn();
    jest.doMock('./ApiOrderRepository', () => ({
      ApiOrderRepository: class ApiOrderRepository {
        createOrder(...args) {
          return centralCreate(...args);
        }
      },
    }));
    jest.doMock('./local/posLocalApiClient', () => ({
      isLocalPosEnabled: () => true,
      localPosRequest: jest.fn(async () => {
        throw new Error('local_pos_unavailable');
      }),
    }));

    const { LocalPosOrderRepository } = require('./LocalPosOrderRepository');

    const repository = new LocalPosOrderRepository();
    await expect(repository.createOrder({
      products: [{ product_id: '667', quantity: 1, price: 250 }],
      payments: [{ amount_paid: 250, payment_mode: 'cash' }],
    })).rejects.toThrow('local_pos_unavailable');
    expect(centralCreate).not.toHaveBeenCalled();
  });

  test('lists orders from local POS API and does not call central list', async () => {
    const centralList = jest.fn();
    const localPosRequest = jest.fn(async () => ({
      items: [{
        id: 'ord_local_1',
        client_order_id: 'client-local-1',
        store_id: 'store-1',
        status: 'paid',
        currency: 'INR',
        subtotal_minor: 12500,
        discount_minor: 0,
        tax_minor: 0,
        total_minor: 12500,
        version: 2,
        created_at: '2026-08-08T10:00:00Z',
        updated_at: '2026-08-08T10:01:00Z',
        items: [{
          id: 'item-1',
          product_id: 'product-1',
          product_name: 'Milk',
          quantity_milli: 1000,
          unit_price_minor: 12500,
          discount_minor: 0,
          tax_minor: 0,
          line_total_minor: 12500,
        }],
      }],
      count: 1,
    }));
    jest.doMock('./ApiOrderRepository', () => ({
      ApiOrderRepository: class ApiOrderRepository {
        listOrders(...args) {
          return centralList(...args);
        }
      },
    }));
    jest.doMock('./local/posLocalApiClient', () => ({
      isLocalPosEnabled: () => true,
      localPosRequest,
    }));

    const { LocalPosOrderRepository } = require('./LocalPosOrderRepository');

    const repository = new LocalPosOrderRepository();
    const result = await repository.listOrders({ page: 2, limit: 25 });

    expect(localPosRequest).toHaveBeenCalledWith('/orders?limit=25&page=2');
    expect(centralList).not.toHaveBeenCalled();
    expect(result.list).toHaveLength(1);
    expect(result.list[0]).toMatchObject({
      id: 'ord_local_1',
      transaction_type: 'sale',
      total_amount: 125,
      payment_status: 'paid',
    });
    expect(result.list[0].items[0]).toMatchObject({
      product_name: 'Milk',
      quantity: 1,
      price: 125,
      total: 125,
    });
  });

  test('loads order detail, payments, and receipt from local POS API only', async () => {
    const centralDetail = jest.fn();
    const localPosRequest = jest.fn(async (path) => {
      if (path === '/orders/ord_local_1') {
        return {
          id: 'ord_local_1',
          client_order_id: 'client-local-1',
          store_id: 'store-1',
          status: 'paid',
          currency: 'INR',
          subtotal_minor: 12500,
          discount_minor: 0,
          tax_minor: 0,
          total_minor: 12500,
          version: 2,
          created_at: '2026-08-08T10:00:00Z',
          updated_at: '2026-08-08T10:01:00Z',
          items: [],
        };
      }
      if (path === '/orders/ord_local_1/payments') {
        return {
          items: [{
            id: 'pay-1',
            order_id: 'ord_local_1',
            mode: 'cash',
            direction: 'in',
            amount_minor: 12500,
            currency: 'INR',
            status: 'captured',
            created_at: '2026-08-08T10:00:30Z',
          }],
          summary: {
            order_id: 'ord_local_1',
            total_minor: 12500,
            paid_minor: 12500,
            balance_minor: 0,
            order_status: 'paid',
          },
        };
      }
      if (path === '/orders/ord_local_1/receipt') {
        return {
          id: 'rcp-1',
          order_id: 'ord_local_1',
          receipt_number: 'STORE-LOCAL-20260808-000001',
          snapshot_sha256: 'abc123',
        };
      }
      throw new Error(`unexpected path ${path}`);
    });
    jest.doMock('./ApiOrderRepository', () => ({
      ApiOrderRepository: class ApiOrderRepository {
        getOrderDetail(...args) {
          return centralDetail(...args);
        }
      },
    }));
    jest.doMock('./local/posLocalApiClient', () => ({
      isLocalPosEnabled: () => true,
      localPosRequest,
    }));

    const { LocalPosOrderRepository } = require('./LocalPosOrderRepository');

    const repository = new LocalPosOrderRepository();
    const detail = await repository.getOrderDetail('ord_local_1');

    expect(centralDetail).not.toHaveBeenCalled();
    expect(localPosRequest).toHaveBeenCalledWith('/orders/ord_local_1');
    expect(localPosRequest).toHaveBeenCalledWith('/orders/ord_local_1/payments');
    expect(localPosRequest).toHaveBeenCalledWith('/orders/ord_local_1/receipt');
    expect(detail).toMatchObject({
      id: 'ord_local_1',
      total_paid: 125,
      balance: 0,
      receipt_number: 'STORE-LOCAL-20260808-000001',
      receipt_snapshot_sha256: 'abc123',
    });
    expect(detail.payment_history[0]).toMatchObject({
      amount: 125,
      payment_mode: 'cash',
      txn_type: 'receipt',
    });
  });

  test('normalizes local partial refunds as returned value without creating balance due', async () => {
    const localPosRequest = jest.fn(async (path) => {
      if (path === '/orders/ord_return_1') {
        return {
          id: 'ord_return_1',
          client_order_id: 'client-return-1',
          store_id: 'store-1',
          status: 'paid',
          currency: 'INR',
          subtotal_minor: 62000,
          discount_minor: 0,
          tax_minor: 0,
          total_minor: 62000,
          version: 3,
          created_at: '2026-08-20T10:00:00Z',
          updated_at: '2026-08-20T10:05:00Z',
          items: [],
        };
      }
      if (path === '/orders/ord_return_1/payments') {
        return {
          items: [
            {
              id: 'pay-capture',
              order_id: 'ord_return_1',
              mode: 'cash',
              direction: 'in',
              amount_minor: 62000,
              currency: 'INR',
              status: 'captured',
              created_at: '2026-08-20T10:01:00Z',
            },
            {
              id: 'pay-refund',
              order_id: 'ord_return_1',
              mode: 'cash',
              direction: 'out',
              amount_minor: 25000,
              currency: 'INR',
              status: 'refunded',
              created_at: '2026-08-20T10:05:00Z',
            },
          ],
          summary: {
            order_id: 'ord_return_1',
            total_minor: 62000,
            paid_minor: 37000,
            balance_minor: 25000,
            order_status: 'partially_paid',
          },
        };
      }
      const error = new Error(`unexpected path ${path}`);
      error.status = 404;
      throw error;
    });
    jest.doMock('./ApiOrderRepository', () => ({
      ApiOrderRepository: class ApiOrderRepository {},
    }));
    jest.doMock('./local/posLocalApiClient', () => ({
      isLocalPosEnabled: () => true,
      localPosRequest,
    }));

    const { LocalPosOrderRepository } = require('./LocalPosOrderRepository');
    const detail = await new LocalPosOrderRepository().getOrderDetail('ord_return_1');

    expect(detail).toMatchObject({
      total_amount: 620,
      total_paid: 620,
      returned_amount: 250,
      net_paid: 370,
      balance: 0,
      payment_status: 'paid',
    });
    expect(detail.payment_history[1]).toMatchObject({
      amount: 250,
      signed_amount: -250,
      txn_type: 'refund',
    });
  });

  test('applies checkout-level discount to local POS order lines', async () => {
    const localPosRequest = jest.fn(async (path, options) => {
      if (path === '/orders' && options?.method === 'POST') {
        return {
          id: 'ord_discount_1',
          client_order_id: 'client-discount-1',
          store_id: 'store-1',
          status: 'confirmed',
          currency: 'INR',
          subtotal_minor: 70000,
          discount_minor: 7000,
          tax_minor: 0,
          total_minor: 63000,
          version: 1,
          created_at: '2026-08-08T10:00:00Z',
          updated_at: '2026-08-08T10:00:00Z',
          items: [],
        };
      }
      if (path === '/orders/ord_discount_1/complete') {
        return {
          order: {
            id: 'ord_discount_1',
            store_id: 'store-1',
            status: 'paid',
            currency: 'INR',
            subtotal_minor: 70000,
            discount_minor: 7000,
            tax_minor: 0,
            total_minor: 63000,
            items: [],
          },
        };
      }
      throw new Error(`unexpected path ${path}`);
    });
    jest.doMock('./ApiOrderRepository', () => ({
      ApiOrderRepository: class ApiOrderRepository {},
    }));
    jest.doMock('./local/posLocalApiClient', () => ({
      isLocalPosEnabled: () => true,
      localPosRequest,
    }));

    const { LocalPosOrderRepository } = require('./LocalPosOrderRepository');

    const repository = new LocalPosOrderRepository();
    await repository.createOrder({
      discount_total: 70,
      products: [
        { product_id: '667', quantity: 1, price: 250 },
        { product_id: '671', quantity: 1, price: 450 },
      ],
      payments: [],
    });

    expect(localPosRequest).toHaveBeenCalledWith('/orders', expect.objectContaining({
      method: 'POST',
      body: expect.objectContaining({
        items: [
          expect.objectContaining({ product_id: '667', discount_minor: 2500 }),
          expect.objectContaining({ product_id: '671', discount_minor: 4500 }),
        ],
      }),
    }));
  });
});
