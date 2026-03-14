import { useEffect, useState } from 'react';
import api from '../../utils/axios';
import MobileShell from '../components/MobileShell';
import SectionCard from '../components/SectionCard';

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const ProductsMobile = () => {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setProducts([]);
      return;
    }
    const handler = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get('/products/search', {
          params: {
            view: 'mobile',
            q: query.trim()
          }
        });
        setProducts(res.data?.products || []);
      } catch (err) {
        console.error('Mobile product search failed', err);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(handler);
  }, [query]);

  return (
    <MobileShell
      title="Products"
      subtitle="Search by name or barcode for quick stock checks."
    >
      <SectionCard title="Search">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search product or scan barcode"
          className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-ember focus:outline-none"
        />
        {loading && <p className="text-sm text-white/60">Searching...</p>}
      </SectionCard>

      <SectionCard title="Results">
        {!loading && query && products.length === 0 && (
          <p className="text-sm text-white/60">No matching products found.</p>
        )}
        {products.map((product) => (
          <div
            key={product.id}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">{product.name}</p>
              <p className="text-sm font-semibold text-white">
                ₹{formatCurrency(product.price)}
              </p>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-white/60">
              <span>Stock: {product.stock}</span>
              {product.barcode ? <span>Barcode: {product.barcode}</span> : <span>No barcode</span>}
            </div>
          </div>
        ))}
      </SectionCard>
    </MobileShell>
  );
};

export default ProductsMobile;
