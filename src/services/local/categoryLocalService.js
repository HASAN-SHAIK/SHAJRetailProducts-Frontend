import { getCategoryRepository } from '../../RepositoryFactory';
import { createRepositoryFacade } from './createRepositoryFacade';

export const {
  getAllCategories,
  getCategoryProducts,
  renameCategory,
  deleteCategory,
  saveCategoriesCache,
  loadCategoriesCache,
} = createRepositoryFacade(() => getCategoryRepository(), [
  'getAllCategories',
  'getCategoryProducts',
  'renameCategory',
  'deleteCategory',
  'saveCategoriesCache',
  'loadCategoriesCache',
]);
