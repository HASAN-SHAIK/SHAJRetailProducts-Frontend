import { useCallback, useEffect, useState } from 'react';
import api from '../../../utils/axios';
import { getAllProducts } from '../../../core/db';
import { runDeltaSync } from '../../../utils/deltaSync';

export const useProductsVM = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchProducts = useCallback(async (skipSync = false) => {
    setLoading(true);
    setError('');
    try {
      if (!skipSync && navigator.onLine) {
        await runDeltaSync({ branchId: null });
      }
      const localAll = await getAllProducts();
      const list = (Array.isArray(localAll) ? localAll : []).filter(
        (item) => !item?.is_deleted
      );
      setProducts(list);
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
    if (navigator.onLine) {
      await runDeltaSync({ branchId: null });
    }
    await fetchProducts(true);
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
