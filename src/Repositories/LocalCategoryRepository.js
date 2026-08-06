import { loadCategoriesCache, saveCategoriesCache } from '../utils/offlineCategories';
import { normalizeCategoryList } from './api/categoryNormalizer';

/** @implements {import('../Interfaces/ICategoryRepository').ICategoryRepository} */
export class LocalCategoryRepository {
  async getAllCategories() {
    return normalizeCategoryList(await this.loadCategoriesCache());
  }

  async getCategoryProducts() {
    return { category: null, products: [], meta: null };
  }

  async renameCategory() {
    throw new Error('Category rename is not available offline');
  }

  async deleteCategory() {
    throw new Error('Category delete is not available offline');
  }

  async saveCategoriesCache(categories) {
    saveCategoriesCache(categories);
  }

  async loadCategoriesCache() {
    return loadCategoriesCache();
  }
}
