import React, { useEffect, useMemo, useRef, useState } from 'react';
import './AddProductModalComponent.css'; // Add this CSS file
import api from '../../../utils/axios';
import { usePopup } from '../../common/PopUp/PopupProvider';
import { searchLocalProducts } from '../../../utils/localProductSearch';

const getSuggestionName = (item) => String(
  item?.name ||
  item?.product_name ||
  item?.product ||
  item?.title ||
  ''
).trim();

const getSuggestionId = (item) => String(
  item?.id ||
  item?.product_id ||
  item?.productId ||
  item?.barcode ||
  getSuggestionName(item)
).trim().toLowerCase();

const normalizeSuggestion = (item) => {
  const name = getSuggestionName(item);
  return {
    ...item,
    __name: name,
    __company: String(item?.company || item?.brand || item?.manufacturer || '').trim(),
    __barcode: String(item?.barcode || '').trim(),
    __category: String(item?.category || item?.category_name || '').trim(),
  };
};

const AddProductModalComponent = ({
  modalId,
  title,
  fields,
  formData,
  onChange,
  onSubmit,
  navigate,
  isSubmitting,
  hsnOptions = [],
  onProductSuggestionSelect,
}) => {
  const [categories, setCategories] = useState([]);
  const [productSuggestions, setProductSuggestions] = useState([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const { showPopup } = usePopup();
  const latestQueryRef = useRef('');

  const productNameValue = useMemo(() => String(formData?.product_name || ''), [formData?.product_name]);

  useEffect(() => {
    const getCategories = async () => {
      try {
        const res = await api.get('/orders/getcategories');
        const list = Array.isArray(res.data?.data)
          ? res.data.data.map((c) => c.category).filter(Boolean)
          : Array.isArray(res.data)
            ? res.data.map((c) => c.category).filter(Boolean)
            : [];
        setCategories(list);
      } catch (err) {
        if (err.response?.status === 401) {
          showPopup("Token Expired Please Login Again!", "Session");
          navigate('/logout');
        } else {
          console.log(err);
        }
      }
    };
    getCategories();
  }, [navigate, showPopup]);

  useEffect(() => {
    const query = productNameValue.trim();
    latestQueryRef.current = query;

    if (query.length < 2) {
      setProductSuggestions([]);
      setShowProductSuggestions(false);
      setProductSearchLoading(false);
      setActiveSuggestionIndex(-1);
      return;
    }

    const timer = setTimeout(async () => {
      setProductSearchLoading(true);
      try {
        const localResults = await searchLocalProducts(query);
        const safeLocalResults = Array.isArray(localResults) ? localResults : [];
        let remoteResults = [];
        const shouldUseServerFallback = safeLocalResults.length === 0;
        if (shouldUseServerFallback && navigator.onLine) {
          try {
            const response = await api.get('/products/search/purchase', { params: { name: query } });
            const payload = response?.data || {};
            remoteResults = Array.isArray(payload?.products)
              ? payload.products
              : Array.isArray(payload?.data)
                ? payload.data
                : Array.isArray(payload)
                  ? payload
                  : [];
          } catch {
            remoteResults = [];
          }
        }

        if (latestQueryRef.current !== query) return;

        const mergedMap = new Map();
        [...safeLocalResults, ...remoteResults].forEach((item) => {
          const normalized = normalizeSuggestion(item);
          if (!normalized.__name) return;
          const key = getSuggestionId(normalized);
          if (!mergedMap.has(key)) {
            mergedMap.set(key, normalized);
          }
        });

        const nextSuggestions = Array.from(mergedMap.values()).slice(0, 8);
        setProductSuggestions(nextSuggestions);
        setShowProductSuggestions(nextSuggestions.length > 0);
        setActiveSuggestionIndex(-1);
      } finally {
        if (latestQueryRef.current === query) {
          setProductSearchLoading(false);
        }
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [productNameValue]);

  const selectSuggestion = (item) => {
    if (!item) return;
    if (typeof onProductSuggestionSelect === 'function') {
      onProductSuggestionSelect(item);
    } else {
      onChange({ target: { name: 'product_name', value: item.__name || '' } });
    }
    setShowProductSuggestions(false);
    setProductSuggestions([]);
    setActiveSuggestionIndex(-1);
  };

  return (
    <div className="modal fade ml-5" id={modalId} tabIndex="-1" aria-labelledby={`${modalId}Label`} aria-hidden="true">
      <div className="modal-dialog modal-dialog-centered custom-modal-width">
        <form onSubmit={onSubmit}>
          <div className="modal-content custom-modal">
            <div className="modal-header border-0">
              <h5 className="modal-title fw-bold text-primary" id={`${modalId}Label`}>{title}</h5>
              <button type="button" className="btn-close btn-close-white custom-close bg-danger position-absolute end-0 m-4" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>

            <div className="modal-body">
              <div className="row">
                {fields.map(({ label, name, type, options, required, autoFocus }) => (
                  <div className="form-group mb-3 col-6" key={name}>
                    <div className="modal-field-row">
                      <label htmlFor={name} className="form-label text-light modal-field-label">
                        {label}
                      </label>
                      <div className="modal-field-input">
                        {(type === 'select' && Array.isArray(options)) ? (
                          <select
                            className="form-select custom-input"
                            id={name}
                            name={name}
                            value={formData[name] || ''}
                            onChange={onChange}
                            required={required !== false}
                          >
                            {options.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        ) : type === 'hsn' ? (
                          <>
                            <input
                              list="hsn-list"
                              className="form-control custom-input"
                              id={name}
                              name={name}
                              value={formData[name] || ''}
                              onChange={onChange}
                              required={required !== false}
                              placeholder={`Enter ${label}`}
                              autoFocus={autoFocus === true}
                            />
                            <datalist id="hsn-list">
                              {hsnOptions.map((option) => (
                                <option
                                  key={option.hsn_code || option.hsn}
                                  value={option.hsn_code || option.hsn}
                                >
                                  {(option.description || '').toString()}
                                </option>
                              ))}
                            </datalist>
                          </>
                        ) : (type === 'datalist' || type === 'select') ? (
                          <>
                            <input
                              list="categories-list"
                              className="form-control custom-input"
                              id={name}
                              name={name}
                              value={formData[name] || ''}
                              onChange={onChange}
                              required={required !== false}
                              placeholder={`Select or type ${label}`}
                              autoFocus={autoFocus === true}
                            />
                            <datalist id="categories-list">
                              {categories && categories.map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </datalist>
                          </>
                        ) : (
                          <input
                            type={type || 'text'}
                            className="form-control custom-input"
                            id={name}
                            name={name}
                            value={formData[name] || ''}
                            onChange={onChange}
                            required={required !== false}
                            autoFocus={autoFocus === true}
                            onKeyDown={(event) => {
                              if (name !== 'product_name' || !showProductSuggestions || productSuggestions.length === 0) return;
                              if (event.key === 'ArrowDown') {
                                event.preventDefault();
                                setActiveSuggestionIndex((prev) => (prev + 1) % productSuggestions.length);
                              } else if (event.key === 'ArrowUp') {
                                event.preventDefault();
                                setActiveSuggestionIndex((prev) => (prev <= 0 ? productSuggestions.length - 1 : prev - 1));
                              } else if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
                                event.preventDefault();
                                selectSuggestion(productSuggestions[activeSuggestionIndex]);
                              } else if (event.key === 'Escape') {
                                setShowProductSuggestions(false);
                              }
                            }}
                            onFocus={() => {
                              if (name === 'product_name' && productSuggestions.length > 0) {
                                setShowProductSuggestions(true);
                              }
                            }}
                            onBlur={() => {
                              if (name === 'product_name') {
                                setTimeout(() => setShowProductSuggestions(false), 120);
                              }
                            }}
                          />
                        )}
                        {name === 'product_name' && (
                          <>
                            {productSearchLoading && (
                              <div className="product-name-suggestion-status">Searching products...</div>
                            )}
                            {showProductSuggestions && productSuggestions.length > 0 && (
                              <div className="product-name-suggestion-list">
                                {productSuggestions.map((item, index) => (
                                  <button
                                    type="button"
                                    key={`${getSuggestionId(item)}-${index}`}
                                    className={`product-name-suggestion-item ${index === activeSuggestionIndex ? 'active' : ''}`}
                                    onMouseDown={() => selectSuggestion(item)}
                                  >
                                    <div className="product-name-suggestion-title">{item.__name}</div>
                                    <div className="product-name-suggestion-meta">
                                      {item.__company || 'No company'} | {item.__category || 'No category'} | {item.__barcode || 'No barcode'}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer border-0">
              <button type="button" className="btn btn-light custom-btn" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" className="btn btn-primary custom-btn" disabled={isSubmitting}>
                {isSubmitting ? 'Adding item...' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProductModalComponent;
