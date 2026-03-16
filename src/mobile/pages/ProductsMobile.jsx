import { useEffect, useState } from 'react';
import api from '../../utils/axios';
import MobileShell from '../components/MobileShell';
import SectionCard from '../components/SectionCard';
import ProductItem from '../components/ProductItem';
import SearchBar from '../components/SearchBar';

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
        <SearchBar
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search product or scan barcode"
        />
        {loading && <p className="text-[12px] text-white/60">Searching...</p>}
      </SectionCard>

      <SectionCard title="Results">
        {!loading && query && products.length === 0 && (
          <p className="text-[12px] text-white/60">No matching products found.</p>
        )}
        {products.map((product) => (
          <ProductItem key={product.id} product={product} />
        ))}
      </SectionCard>
    </MobileShell>
  );
};

export default ProductsMobile;
