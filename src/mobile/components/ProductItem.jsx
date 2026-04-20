const formatCurrency = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const ProductItem = ({ product }) => {
  const stock = Number(product?.stock ?? product?.stock_quantity ?? 0);
  const stockTone = stock > 20 ? 'success' : stock > 0 ? 'warn' : 'danger';

  return (
    <article className="mobile-item">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{product?.name || 'Unnamed Product'}</p>
          <p className="mobile-muted" style={{ margin: '3px 0 0', fontSize: 10 }}>
            SKU: {product?.sku || product?.code || 'NA'}
          </p>
        </div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
          Rs {formatCurrency(product?.price ?? product?.selling_price ?? product?.purchase_price ?? 0)}
        </p>
      </div>

      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <p className="mobile-muted" style={{ margin: 0, fontSize: 10 }}>
          {product?.category || product?.category_name || 'General'}
          {' • '}
          {product?.barcode || 'No barcode'}
        </p>
        <span className={`mobile-badge ${stockTone}`}>Stock {stock}</span>
      </div>
    </article>
  );
};

export default ProductItem;
