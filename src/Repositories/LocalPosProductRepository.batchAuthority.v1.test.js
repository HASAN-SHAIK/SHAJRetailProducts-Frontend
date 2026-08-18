describe('V1 local POS batch mutation authority', () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  const loadRepository = (enabled) => {
    const parentUpdate = jest.fn(async (batches) => batches);
    jest.doMock('./ApiProductRepository', () => ({
      ApiProductRepository: class ApiProductRepository {
        constructor() {
          this.cache = {};
        }

        updateBatchesBulk(batches) {
          return parentUpdate(batches);
        }
      },
    }));
    jest.doMock('./local/posLocalApiClient', () => ({
      isLocalPosEnabled: () => enabled,
      localPosRequest: jest.fn(),
    }));

    const { LocalPosProductRepository } = require('./LocalPosProductRepository');
    return { repository: new LocalPosProductRepository(), parentUpdate };
  };

  test('fails closed instead of mutating browser batch cache when POSService is authoritative', async () => {
    const { repository, parentUpdate } = loadRepository(true);

    await expect(repository.updateBatchesBulk([{ id: 'batch-1', quantity_remaining: 4 }]))
      .rejects.toMatchObject({ code: 'LOCAL_POS_BATCH_MUTATION_CENTRAL_ONLY' });
    expect(parentUpdate).not.toHaveBeenCalled();
  });

  test('preserves legacy browser batch mutation only when local POS mode is disabled', async () => {
    const { repository, parentUpdate } = loadRepository(false);
    const batches = [{ id: 'batch-legacy', quantity_remaining: 3 }];

    await expect(repository.updateBatchesBulk(batches)).resolves.toEqual(batches);
    expect(parentUpdate).toHaveBeenCalledWith(batches);
  });
});
