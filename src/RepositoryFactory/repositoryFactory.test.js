jest.mock('axios', () => ({
  create: (options = {}) => ({
    defaults: { baseURL: options.baseURL || '' },
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  }),
}));

const loadFactory = (localEnabled) => {
  jest.resetModules();
  process.env.REACT_APP_POS_LOCAL_API_ENABLED = localEnabled ? 'true' : 'false';
  process.env.REACT_APP_PRODUCT_REPOSITORY = 'api';
  process.env.REACT_APP_CUSTOMER_REPOSITORY = 'api';
  process.env.REACT_APP_SALES_REPOSITORY = 'api';
  return require('./index');
};

describe('RepositoryFactory local POS routing', () => {
  afterEach(() => {
    delete process.env.REACT_APP_POS_LOCAL_API_ENABLED;
    delete process.env.REACT_APP_PRODUCT_REPOSITORY;
    delete process.env.REACT_APP_CUSTOMER_REPOSITORY;
    delete process.env.REACT_APP_SALES_REPOSITORY;
    jest.restoreAllMocks();
  });

  test('selects legacy API repositories when local POS is disabled', () => {
    const factory = loadFactory(false);

    expect(factory.getOrderRepository().constructor.name).toBe('ApiOrderRepository');
    expect(factory.getCustomerRepository().constructor.name).toBe('ApiCustomerRepository');
    expect(factory.getProductRepository().constructor.name).toBe('ApiProductRepository');
  });

  test('selects local POS repositories when local POS is enabled', () => {
    const factory = loadFactory(true);

    expect(factory.getOrderRepository().constructor.name).toBe('LocalPosOrderRepository');
    expect(factory.getCustomerRepository().constructor.name).toBe('LocalPosCustomerRepository');
    expect(factory.getProductRepository().constructor.name).toBe('LocalPosProductRepository');
  });
});
