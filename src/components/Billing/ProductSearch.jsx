import React, { useMemo, useState } from 'react';

const ProductSearch = ({ value, suggestions, loading, error, onChange, onSelect, onRetry }) => {
  const [companyFilter, setCompanyFilter] = useState('');
  const searchInputRef = React.useRef(null);
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);
  const companyOptions = useMemo(() => Array.from(new Set(
    (suggestions || [])
      .map((item) => String(item?.company || item?.company_name || '').trim())
      .filter(Boolean)
  )).sort((a, b) => a.localeCompare(b)), [suggestions]);
  const visibleSuggestions = companyFilter
    ? (suggestions || []).filter((item) =>
        String(item?.company || item?.company_name || '').trim().toLowerCase() === companyFilter.toLowerCase()
      )
    : suggestions;

  return <div className="billing-search" aria-busy={loading}>
    <label className="billing-label">
      Search Product
      <input
        className="form-control billing-input"
        ref={searchInputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search by name, company, or barcode"
      />
    </label>
    <label className="billing-label">
      Filter by Company
      <select
        className="form-select billing-input"
        value={companyFilter}
        onChange={(event) => setCompanyFilter(event.target.value)}
      >
        <option value="">All companies</option>
        {companyOptions.map((company) => <option key={company} value={company}>{company}</option>)}
      </select>
    </label>
    {loading && (
      <div className="billing-search-status" role="status" aria-live="polite">
        Searching...
      </div>
    )}
    {error && (
      <div className="alert alert-danger d-flex align-items-center justify-content-between gap-2" role="alert">
        <span>{error}</span>
        {onRetry && (
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={onRetry} disabled={loading}>
            {loading ? 'Retrying...' : 'Retry POS search'}
          </button>
        )}
      </div>
    )}
    {visibleSuggestions.length > 0 && (
      <div className="billing-search-list">
        {visibleSuggestions.map((item, idx) => (
          <button
            key={`${item.key || item.id || item.product_id || item.barcode || item.name}-${item.batch_id || 'no-batch'}-${idx}`}
            type="button"
            className="billing-search-item"
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
  </div>;
};

export default ProductSearch;
