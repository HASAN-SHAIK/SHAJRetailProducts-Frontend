const STORAGE_KEY = 'offline_categories_cache_v1';

export const saveCategoriesCache = (categories) => {
  try {
    const safe = Array.isArray(categories) ? categories : [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
  } catch {
    // ignore
  }
};

export const loadCategoriesCache = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
