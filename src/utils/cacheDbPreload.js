import { runDeltaSync } from './deltaSync';

export const preloadProductsViaFetch = async () => {
  await runDeltaSync({}).catch(() => {});
};
