import { useEffect, useMemo, useState } from 'react';
import api from '../../utils/axios';
import { searchLocalProducts, normalizeDisplayProduct } from '../../utils/localProductSearch';
import MobileShell from '../components/MobileShell';
import SectionCard from '../components/SectionCard';
import ProductItem from '../components/ProductItem';
import SearchBar from '../components/SearchBar';

const sorters = {
  relevance: (a, b) => String(a?.name || '').localeCompare(String(b?.name || '')),
  stockHigh: (a, b) => Number(b?.stock ?? b?.stock_quantity ?? 0) - Number(a?.stock ?? a?.stock_quantity ?? 0),
  stockLow: (a, b) => Number(a?.stock ?? a?.stock_quantity ?? 0) - Number(b?.stock ?? b?.stock_quantity ?? 0),
  priceHigh: (a, b) => Number(b?.price ?? b?.selling_price ?? 0) - Number(a?.price ?? a?.selling_price ?? 0),
  priceLow: (a, b) => Number(a?.price ?? a?.selling_price ?? 0) - Number(b?.price ?? b?.selling_price ?? 0),
};

const ProductsMobile = () => {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [sortBy, setSortBy] = useState('relevance');

  useEffect(() => {
    if (!query.trim()) {
      setProducts([]);
      return;
    }

    const handler = setTimeout(async () => {
      setLoading(true);
      try {
        const localResults = await searchLocalProducts(query.trim());
        if (localResults.length) {
          const mapped = localResults.map(normalizeDisplayProduct).map((product) => ({
            ...product,
            price: product.price ?? product.selling_price ?? product.purchase_price ?? 0,
            stock: product.stock ?? product.stock_quantity ?? 0,
          }));
          setProducts(mapped);
          return;
        }

        const res = await api.get('/products/search', {
          params: {
            view: 'mobile',
            q: query.trim(),
          },
        });
        setProducts(res.data?.products || []);
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [query]);

  const categories = useMemo(() => {
    const set = new Set();
    products.forEach((product) => {
      const category = product?.category || product?.category_name;
      if (category) set.add(category);
    });
    return ['all', ...Array.from(set)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const filtered = products.filter((product) => {
      const stock = Number(product?.stock ?? product?.stock_quantity ?? 0);
      const category = product?.category || product?.category_name;
      const matchesCategory = categoryFilter === 'all' || category === categoryFilter;
      const matchesStock =
        stockFilter === 'all' ||
        (stockFilter === 'in' && stock > 0) ||
        (stockFilter === 'low' && stock > 0 && stock <= 10) ||
        (stockFilter === 'out' && stock <= 0);
      return matchesCategory && matchesStock;
    });

    return filtered.sort(sorters[sortBy] || sorters.relevance);
  }, [categoryFilter, products, sortBy, stockFilter]);

  return (
    <MobileShell title="Products" subtitle="Search inventory quickly and filter by category, stock and pricing.">
      <SectionCard title="Search & Filters">
        <SearchBar value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search product name or barcode" />

        <div className="mobile-inline-grid">
          <div>
            <label className="mobile-label">Category</label>
            <select className="mobile-field" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              {categories.map((category) => (
                <option key={category} value={category}>{category === 'all' ? 'All categories' : category}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mobile-label">Stock</label>
            <select className="mobile-field" value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}>
              <option value="all">All stock</option>
              <option value="in">In stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mobile-label">Sort By</label>
          <select className="mobile-field" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="relevance">Name (A-Z)</option>
            <option value="stockHigh">Stock high to low</option>
            <option value="stockLow">Stock low to high</option>
            <option value="priceHigh">Price high to low</option>
            <option value="priceLow">Price low to high</option>
          </select>
        </div>
      </SectionCard>

      <SectionCard title="Results" action={<span className="mobile-chip">{filteredProducts.length} items</span>}>
        {!query && <p className="mobile-muted" style={{ margin: 0, fontSize: 12 }}>Start typing to search products.</p>}
        {loading && <p className="mobile-muted" style={{ margin: 0, fontSize: 12 }}>Searching products...</p>}
        {!loading && query && filteredProducts.length === 0 && (
          <p className="mobile-muted" style={{ margin: 0, fontSize: 12 }}>No products match your filters.</p>
        )}
        {filteredProducts.map((product) => (
          <ProductItem key={product.id || product.barcode || product.name} product={product} />
        ))}
      </SectionCard>
    </MobileShell>
  );
};

export default ProductsMobile;
