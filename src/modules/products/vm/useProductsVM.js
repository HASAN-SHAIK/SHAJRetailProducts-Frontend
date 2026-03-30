import { useCallback, useEffect, useState } from 'react';
import api from '../../../utils/axios';
import { updateProductsBulk } from '../../../core/db';
import { saveProductsCache } from '../../../utils/offlineProducts';

const extractList = (res) => {
  const payload = res?.data?.products || res?.data?.data || res?.data || [];
  return Array.isArray(payload) ? payload : [];
};

export const useProductsVM = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/products');
      const list = extractList(res);
      setProducts(list);
      if (list.length) {
        updateProductsBulk(list).catch(() => {});
        saveProductsCache(list);
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const savePriceEdits = async (items = []) => {
    const payload = items.map((p) => ({
      id: p.id,
      selling_price: p.selling_price,
      mrp: p.mrp,
      gst_percentage: p.gst_percentage,
    }));
    if (!payload.length) return { success: false };
    await api.put('/products/bulk-update', { products: payload });
    await fetchProducts();
    return { success: true };
  };

  return {
    products,
    loading,
    error,
    fetchProducts,
    savePriceEdits,
  };
};

export default useProductsVM;
