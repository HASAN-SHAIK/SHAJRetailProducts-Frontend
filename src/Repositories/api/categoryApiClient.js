import api from '../../utils/axios';
import { normalizeCategoryList } from './categoryNormalizer';

const extractCategoriesPayload = (response) => {
  const data = response?.data ?? {};
  if (Array.isArray(data.data?.categories)) return data.data.categories;
  if (Array.isArray(data.categories)) return data.categories;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
};

export const fetchCategories = async ({ search = '' } = {}) => {
  try {
    const response = await api.get('/v1/categories', {
      params: {
        search: search || undefined,
        limit: 200,
      },
    });
    return normalizeCategoryList(extractCategoriesPayload(response));
  } catch {
    const response = await api.get('/orders/getcategories');
    const raw = response?.data?.categories || response?.data?.data || response?.data || [];
    return normalizeCategoryList(raw);
  }
};

export const fetchCategoryProducts = async (name, { page = 1, limit = 50 } = {}) => {
  const encoded = encodeURIComponent(String(name || '').trim());
  const response = await api.get(`/v1/categories/${encoded}/products`, {
    params: { page, limit },
  });
  const payload = response?.data?.data ?? response?.data ?? {};
  return {
    category: payload.category ?? name,
    products: Array.isArray(payload.products) ? payload.products : [],
    meta: response?.data?.meta ?? null,
  };
};

export const renameCategoryRemote = async (oldName, newName) => {
  const encoded = encodeURIComponent(String(oldName || '').trim());
  const response = await api.put(`/v1/categories/${encoded}`, {
    name: String(newName || '').trim(),
  });
  return response?.data?.data ?? response?.data ?? {};
};

export const deleteCategoryRemote = async (name) => {
  const encoded = encodeURIComponent(String(name || '').trim());
  await api.delete(`/v1/categories/${encoded}`);
};

export const isOnline = () => typeof navigator !== 'undefined' && navigator.onLine;
