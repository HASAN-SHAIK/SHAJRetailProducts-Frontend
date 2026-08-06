/**
 * @typedef {object} ICategoryRepository
 * @property {(options?: { search?: string }) => Promise<object[]>} getAllCategories
 * @property {(name: string, query?: { page?: number, limit?: number }) => Promise<object>} getCategoryProducts
 * @property {(oldName: string, newName: string) => Promise<object>} renameCategory
 * @property {(name: string) => Promise<void>} deleteCategory
 * @property {(categories: object[]) => Promise<void>} saveCategoriesCache
 * @property {() => Promise<object[]>} loadCategoriesCache
 */

export {};
