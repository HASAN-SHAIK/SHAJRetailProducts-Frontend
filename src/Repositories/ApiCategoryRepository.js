import { LocalCategoryRepository } from './LocalCategoryRepository';
import {
  deleteCategoryRemote,
  fetchCategories,
  fetchCategoryProducts,
  isOnline,
  renameCategoryRemote,
} from './api/categoryApiClient';

/** @implements {import('../Interfaces/ICategoryRepository').ICategoryRepository} */
export class ApiCategoryRepository {
  constructor() {
    this.cache = new LocalCategoryRepository();
  }

  async getAllCategories(options = {}) {
    if (isOnline()) {
      try {
        const categories = await fetchCategories(options);
        if (categories.length) {
          await this.cache.saveCategoriesCache(categories);
        }
        return categories;
      } catch {
        // Fall back to cached categories when remote fetch fails.
      }
    }
    return this.cache.getAllCategories();
  }

  async getCategoryProducts(name, query = {}) {
    if (!isOnline()) {
      return this.cache.getCategoryProducts(name, query);
    }
    return fetchCategoryProducts(name, query);
  }

  async renameCategory(oldName, newName) {
    if (!isOnline()) {
      return this.cache.renameCategory(oldName, newName);
    }
    const result = await renameCategoryRemote(oldName, newName);
    const cached = await this.cache.loadCategoriesCache();
    const next = cached.map((item) => {
      const record = typeof item === 'string' ? { id: item, name: item } : item;
      if (String(record?.name || '').toLowerCase() === String(oldName || '').toLowerCase()) {
        return { ...record, id: newName, name: newName };
      }
      return record;
    });
    await this.cache.saveCategoriesCache(next);
    return result;
  }

  async deleteCategory(name) {
    if (!isOnline()) {
      return this.cache.deleteCategory(name);
    }
    await deleteCategoryRemote(name);
    const cached = await this.cache.loadCategoriesCache();
    const next = cached.filter((item) => {
      const record = typeof item === 'string' ? { name: item } : item;
      return String(record?.name || '').toLowerCase() !== String(name || '').toLowerCase();
    });
    await this.cache.saveCategoriesCache(next);
  }

  saveCategoriesCache(categories) {
    return this.cache.saveCategoriesCache(categories);
  }

  loadCategoriesCache() {
    return this.cache.loadCategoriesCache();
  }
}
