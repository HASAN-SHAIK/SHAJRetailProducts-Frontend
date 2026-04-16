import React from 'react';

const ProductSearch = ({ value, suggestions, loading, onChange, onSelect }) => (
  <div className="billing-search">
    <label className="billing-label">
      Search Product
      <input
        className="form-control billing-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search by name, company, or barcode"
      />
    </label>
    {loading && <div className="billing-search-status">Searching...</div>}
    {suggestions.length > 0 && (
      <div className="billing-search-list">
        {suggestions.map((item, idx) => (
          <button
            key={`${item.key || item.id || item.product_id || item.barcode || item.name}-${item.batch_id || 'no-batch'}-${idx}`}
            type="button"
            className="billing-search-item"
            onPointerDown={() => onSelect(item)}
            onClick={(event) => {
              event.preventDefault();
              onSelect(item);
            }}
          >
            <div>
              <strong>{item.name || item.product_name || '-'}</strong>
              {item.company && <span>Company: {item.company}</span>}
              {item.batch_number && <span>Batch: {item.batch_number}</span>}
              <span>{item.barcode ? `Barcode: ${item.barcode}` : ''}</span>
              {Number.isFinite(item.__stock) && (
                <span className="billing-search-stock">Stock: {item.__stock}</span>
              )}
              {item.location_tag && (
                <span className="billing-search-stock">{item.location_tag}</span>
              )}
            </div>
            <div className="billing-search-price">INR {Number(item.selling_price || item.price || 0).toFixed(2)}</div>
          </button>
        ))}
      </div>
    )}
  </div>
);

export default ProductSearch;
