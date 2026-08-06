/**
 * Builds a thin service facade that delegates to a repository singleton.
 * Pass a thunk that looks up the repository at call time (not at module init)
 * to avoid circular-import TDZ errors, e.g. `() => getProductRepository()`.
 * @param {() => object} getRepository
 * @param {string[]} methodNames
 */
export function createRepositoryFacade(getRepository, methodNames) {
  const facade = {};
  for (const name of methodNames) {
    facade[name] = (...args) => getRepository()[name](...args);
  }
  return facade;
}
