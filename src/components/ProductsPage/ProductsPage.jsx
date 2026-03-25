import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './ProductsPage.css'; // Custom styles
import api from '../../utils/axios';
import { Modal } from 'bootstrap';
import AddProductModalComponent from './AddModalComponent/AddProductModalComponent';
import { useSelector } from 'react-redux';
import { saveProductsCache } from '../../utils/offlineProducts';
import { getAllProducts, updateProduct } from '../../core/db';
import { usePopup } from '../common/PopUp/PopupProvider';
import EditProductModal from './EditOrderModal/EditProductModal';

const ProductsPage = ({ navigate }) => {
//Modal data
 const [productUpdateFlag, setProductUpdateFlag] = useState(false);
 const userDetails = useSelector((state) => state.user.userDetails);
 const tenantConfig = useSelector((state) => state.tenant.tenantConfig);
 const features = tenantConfig?.features || tenantConfig?.plan_features || tenantConfig || {};
 const weightBasedEnabled =
  features.enable_weight_based !== false &&
  tenantConfig?.enable_weight_based !== false;
 const pieceBasedEnabled =
  features.enable_piece_based !== false &&
  tenantConfig?.enable_piece_based !== false;
 const barcodeEnabled = features.enable_barcode === true;
 const defaultWeightValue = weightBasedEnabled && !pieceBasedEnabled ? '1' : '0';
 const { showPopup } = usePopup();
 const [formData, setFormData] = useState({
  product_name: '',
    company: '',
    selling_price: '',
    actual_price: '',
    stock_quantity: '',
    category: '',
    expiry_date: '',
    time_for_delivery: '',
    is_weight_based: defaultWeightValue,
    barcode: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pieceBasedEnabled && formData.is_weight_based === '0') {
      showPopup('Piece-based products are disabled for this tenant.', 'Feature');
      return;
    }
    if (!weightBasedEnabled && formData.is_weight_based === '1') {
      showPopup('Weight-based products are disabled for this tenant.', 'Feature');
      return;
    }

    try {
      setIsAddingProduct(true);
      const payload = barcodeEnabled ? formData : (({ barcode, ...rest }) => rest)(formData);
      if (payload.expiry_date === '') payload.expiry_date = null;
      const createRes = await api.post('/products', payload); // Your endpoint
      const createdProduct = extractProductFromResponse(createRes);
      if (createdProduct) {
        updateProduct(createdProduct).catch(() => {});
      }
      // Optional: show success toast, close modal, refresh product list
      setFormData({
        product_name: '',
        company: '',
        category:'',
        expiry_date: '',
        selling_price: '',
        actual_price: '',
        stock_quantity: '',
        time_for_delivery: '',
        is_weight_based: defaultWeightValue,
        barcode: ''
      });
      const modalElement = document.getElementById('addProductModal');
      const modal = Modal.getInstance(modalElement);
      modal.hide();
      showPopup("Product added successfully!", "Success");
      setForceApiFetch(true);
      setProductUpdateFlag(true)

    } catch (err) {
      if(err.response.data.message === 'Invalid Token' || err.response.status === 401){
      showPopup("Token Expired Please Login Again!", "Session");
      navigate('/logout');
      }
      else{
      showPopup("Issue while adding please try later", "Error");
      console.error('Error adding product:', err);
      }
    } finally {
      setIsAddingProduct(false);
    }
    
  };

  const productFields = [
    { label: 'Product Name', name: 'product_name' },
    { label: 'Company', name: 'company' },
    ...(barcodeEnabled ? [{ label: 'Barcode', name: 'barcode', required: false, autoFocus: true }] : []),
    { label: 'Category', name: 'category', type: 'datalist' },
    { label: 'Selling Price', name: 'selling_price', type: 'number' },
    { label: 'Actual Price', name: 'actual_price', type: 'number' },
    { label: 'Expiry Date', name: 'expiry_date', type: 'date', required: false },
    { label: 'Quantity', name: 'stock_quantity', type: 'number' },
    { label: 'Time For Delivery', name:'time_for_delivery', type: 'number'},
    { label: 'Type', name: 'is_weight_based', type: 'select', options: [
      ...(pieceBasedEnabled ? [{ label: 'Piece-based', value: '0' }] : []),
      ...(weightBasedEnabled ? [{ label: 'Weight-based', value: '1' }] : [])
    ]},
  ];

 const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
 const [errorMessage, setErrorMessage] = useState('');
 const [pagination, setPagination] = useState({
  page: 1,
  limit: 10,
  total_pages: 1,
  total_records: 0,
 });
 const [searchInput, setSearchInput] = useState('');
 const [searchQuery, setSearchQuery] = useState('');
 const [selectedCategory, setSelectedCategory] = useState('');
 const [sortBy, setSortBy] = useState('created_at');
 const [sortOrder, setSortOrder] = useState('desc');
 const [editTarget, setEditTarget] = useState(null);
 const [deleteModalOpen, setDeleteModalOpen] = useState(false);
 const [deleteTarget, setDeleteTarget] = useState(null);
 const [deletingId, setDeletingId] = useState(null);
 const [isAddingProduct, setIsAddingProduct] = useState(false);
 const [isEditingProduct, setIsEditingProduct] = useState(false);
 const [forceApiFetch, setForceApiFetch] = useState(false);
 const [extraDetailsByBarcode, setExtraDetailsByBarcode] = useState({});
 const [dataSource, setDataSource] = useState('server');
 const [cacheMeta, setCacheMeta] = useState({ total: 0, shown: 0 });
 const [editDetailsStatus, setEditDetailsStatus] = useState({
  state: 'idle',
  message: '',
  source: 'indexeddb',
 });

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchExtraDetails = async () => {
      if (!navigator.onLine || window.__serverOffline) return;
      const barcodes = products
        .map((item) => item?.barcode)
        .filter((barcode) => barcode);
      if (barcodes.length === 0) {
        setExtraDetailsByBarcode({});
        return;
      }
      try {
        const res = await api.post('/products/extra-details', { barcodes });
        const payload = res?.data?.products ?? res?.data ?? [];
        const list = Array.isArray(payload) ? payload : [];
        if (list.length === 0) {
          setExtraDetailsByBarcode({});
          return;
        }
        const map = list.reduce((acc, item) => {
          if (item?.barcode) {
            acc[item.barcode] = item;
          }
          return acc;
        }, {});
        setExtraDetailsByBarcode(map);
      } catch (err) {
        console.warn('[Products] Failed to fetch extra details', err);
      }
    };
    fetchExtraDetails();
  }, [products]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination((prev) => ({ ...prev, page: 1 }));
      setSearchQuery(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    fetchProducts();
  }, [productUpdateFlag, pagination.page, pagination.limit, searchQuery, selectedCategory, sortBy, sortOrder]);

  const buildParams = useCallback(() => {
    const params = {
      page: pagination.page,
      limit: pagination.limit,
      search: searchQuery || undefined,
      category_id: selectedCategory || undefined,
      sort_by: sortBy,
      sort_order: sortOrder,
    };
    return params;
  }, [pagination.page, pagination.limit, searchQuery, selectedCategory, sortBy, sortOrder]);

  const normalizeValue = (value) => String(value ?? '').toLowerCase();

  const applyLocalFilters = useCallback((items) => {
    let filtered = Array.isArray(items) ? items : [];

    if (searchQuery) {
      const query = normalizeValue(searchQuery);
      filtered = filtered.filter((item) => {
        const name = normalizeValue(item.name ?? item.product_name);
        const company = normalizeValue(item.company ?? item.company_name);
        const barcode = normalizeValue(item.barcode);
        return name.includes(query) || company.includes(query) || barcode.includes(query);
      });
    }

    if (selectedCategory) {
      const categoryKey = normalizeValue(selectedCategory);
      filtered = filtered.filter((item) => {
        const categoryId = normalizeValue(item.category_id ?? item.categoryId);
        const categoryName = normalizeValue(item.category ?? item.category_name);
        return categoryId === categoryKey || categoryName === categoryKey;
      });
    }

    const sortField = sortBy;
    const direction = sortOrder === 'asc' ? 1 : -1;
    const sorted = [...filtered].sort((a, b) => {
      const aValue = a?.[sortField];
      const bValue = b?.[sortField];
      const aNumeric = Number(aValue);
      const bNumeric = Number(bValue);
      if (!Number.isNaN(aNumeric) && !Number.isNaN(bNumeric)) {
        return (aNumeric - bNumeric) * direction;
      }
      return normalizeValue(aValue).localeCompare(normalizeValue(bValue)) * direction;
    });

    return sorted;
  }, [searchQuery, selectedCategory, sortBy, sortOrder]);

  const paginateItems = (items) => {
    const totalRecords = items.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pagination.limit));
    const page = Math.min(Math.max(1, pagination.page), totalPages);
    const start = (page - 1) * pagination.limit;
    const paged = items.slice(start, start + pagination.limit);
    return { paged, totalRecords, totalPages, page };
  };

  const fetchProducts = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      if (!forceApiFetch) {
        const localAll = await getAllProducts();
        const localList = Array.isArray(localAll) ? localAll : [];
        if (localList.length > 0) {
          const localFiltered = applyLocalFilters(localList);
          if (localFiltered.length > 0 || (!searchQuery && !selectedCategory)) {
            const { paged, totalRecords, totalPages, page } = paginateItems(localFiltered);
            setProducts(paged);
            setDataSource('indexeddb');
            setCacheMeta({ total: localList.length, shown: paged.length });
            setPagination((prev) => ({
              ...prev,
              page,
              total_pages: totalPages,
              total_records: totalRecords,
            }));
            return;
          }
        }
      }

      const response = await api.get('/products', { params: buildParams() });
      const payload = response?.data || {};
      const list = Array.isArray(payload.products) ? payload.products : [];
      setProducts(list);
      setDataSource('server');
      setCacheMeta({ total: payload.pagination?.total_records ?? list.length, shown: list.length });
      saveProductsCache(list);
      setForceApiFetch(false);
      setPagination((prev) => ({
        ...prev,
        page: payload.pagination?.page || prev.page,
        limit: payload.pagination?.limit || prev.limit,
        total_pages: payload.pagination?.total_pages || 1,
        total_records: payload.pagination?.total_records || 0,
      }));
    } catch (err) {
      if (err.response?.data?.message === 'Invalid Token' || err.response?.status === 401) {
        showPopup("Token Expired Please Login Again!", "Session");
        navigate('/logout');
      } else {
        setErrorMessage('Unable to load products. Please try again.');
      }
    } finally {
      if (forceApiFetch) {
        setForceApiFetch(false);
      }
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/orders/getcategories');
      const raw = res?.data?.categories || res?.data?.data || res?.data || [];
      const list = Array.isArray(raw) ? raw : [];
      const normalized = list.map((item) => {
        if (typeof item === 'string') {
          return { id: item, name: item };
        }
        return {
          id: item.id ?? item.category_id ?? item.value ?? item.category ?? item.name,
          name: item.name ?? item.category ?? item.label ?? item.title ?? '',
        };
      }).filter((item) => item.name);
      setCategories(normalized);
    } catch (err) {
      if (err.response?.data?.message === 'Invalid Token' || err.response?.status === 401) {
        showPopup("Token Expired Please Login Again!", "Session");
        navigate('/logout');
      } else {
        console.log("Failed to load categories", err);
      }
    }
  };

  const categoryOptions = useMemo(
    () => categories,
    [categories]
  );

  const formatDate = (value) => {
    if (!value) return '-';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      if (Number.isNaN(date.getTime())) return '-';
      return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatMoney = (value) => {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(Number.isFinite(amount) ? amount : 0);
  };

  const handleSortToggle = (field) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const getSortIndicator = (field) => {
    if (sortBy !== field) return '';
    return sortOrder === 'asc' ? '^' : 'v';
  };

  const handleOpenModal = () => {
    if (!pieceBasedEnabled && !weightBasedEnabled) {
      showPopup('Product types are disabled for this tenant.', 'Feature');
      return;
    }
    const modalElement = document.getElementById('addProductModal');
    const bootstrapModal = new Modal(modalElement);
    setShowModal(true);
    bootstrapModal.show();
  };

  const extractProductFromResponse = (response) => {
    if (!response) return null;
    const data = response?.data;
    if (!data) return null;
    if (Array.isArray(data)) return data[0] || null;
    if (Array.isArray(data.products)) return data.products[0] || null;
    return data.product || data.data || data;
  };

  const handleEditClick = async (product) => {
    setEditDetailsStatus({
      state: 'loading',
      message: 'Getting latest details from server...',
      source: 'server',
    });

    if (!navigator.onLine) {
      setEditDetailsStatus({
        state: 'offline',
        message: 'Offline mode: cannot fetch latest details.',
        source: 'indexeddb',
      });
      return;
    }

    try {
      let response = null;
      const productId = product?.id ?? product?.product_id ?? product?.productId;
      if (productId) {
        response = await api.get(`/products/${productId}`);
      }
      const serverItem = extractProductFromResponse(response);
      if (serverItem) {
        setEditTarget({ ...product, ...serverItem });
        updateProduct(serverItem).catch(() => {});
        setEditDetailsStatus({
          state: 'ready',
          message: 'Latest details loaded from server.',
          source: 'server',
        });
      } else {
        setEditDetailsStatus({
          state: 'error',
          message: productId ? 'No server details found.' : 'Missing product id.',
          source: 'server',
        });
      }
    } catch (error) {
      console.warn('[Products] Failed to fetch product details', error);
      setEditDetailsStatus({
        state: 'error',
        message: 'Unable to fetch latest details.',
        source: 'server',
      });
    }
  };

  const handleSubmitEdit = async (updatedProduct) => {
    if (!pieceBasedEnabled && String(updatedProduct.is_weight_based) === '0') {
      showPopup('Piece-based products are disabled for this tenant.', 'Feature');
      return;
    }
    if (!weightBasedEnabled && String(updatedProduct.is_weight_based) === '1') {
      showPopup('Weight-based products are disabled for this tenant.', 'Feature');
      return;
    }
    try {
      setIsEditingProduct(true);
      const payload = barcodeEnabled ? updatedProduct : (({ barcode, ...rest }) => rest)(updatedProduct);
      const response = await api.put(`/products/${updatedProduct.id}`, payload);
      if (response.status === 200) {
        showPopup('Product updated successfully!', 'Success');
        setEditTarget(null);
        setForceApiFetch(true);
        setProductUpdateFlag((prev) => !prev);
      }
    } catch (error) {
      console.error('Failed to update product:', error);
      showPopup('Error updating product', 'Error');
    } finally {
      setIsEditingProduct(false);
    }
  };

  const openDeleteModal = (product) => {
    setDeleteTarget(product);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setDeleteTarget(null);
  };

  const handleDeleteProduct = async () => {
    const productId = deleteTarget?.id;
    if (!productId) return;
    setDeletingId(productId);
    try {
      await api.delete(`/products/${productId}`);
      showPopup('Product deleted', 'Success');
      closeDeleteModal();
      setForceApiFetch(true);
      setProductUpdateFlag((prev) => !prev);
    } catch (err) {
      showPopup('Failed to delete product', 'Error');
    } finally {
      setDeletingId(null);
    }
  };
  return (
    <div className="wow-page products-page">
      <div className="wow-motion-layer" aria-hidden="true">
        <span className="wow-orb orb-a"></span>
        <span className="wow-orb orb-b"></span>
        <span className="wow-orb orb-c"></span>
        <span className="wow-orb orb-d"></span>
        <span className="wow-ring ring-a"></span>
        <span className="wow-ring ring-b"></span>
        <span className="wow-pulse"></span>
      </div>
      <div className="wow-content container-fluid pt-4">
        <div className="products-header">
          <div>
            {/* <h2 className="products-title">Products</h2> */}
            <p className="products-subtitle">Search, filter, and manage inventory.</p>
          </div>
          <div className="d-flex gap-2">
            <button
              className="btn btn-outline-light"
              onClick={() => {
                setForceApiFetch(true);
                setProductUpdateFlag((prev) => !prev);
              }}
              type="button"
            >
              Refresh from Server
            </button>
            {userDetails.role === 'admin' && (
              <button className="btn btn-success" onClick={handleOpenModal}>
                Add Product
              </button>
            )}
          </div>
        </div>

        <div className="products-controls">
          <input
            className="form-control search-input"
            placeholder="Search by product name or company"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <select
            className="form-select category-select"
            value={selectedCategory}
            onChange={(event) => {
              setSelectedCategory(event.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <option value="">All Categories</option>
            {categoryOptions.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <div className="sort-controls">
            <select
              className="form-select sort-select"
              value={sortBy}
              onChange={(event) => {
                setSortBy(event.target.value);
                setSortOrder('asc');
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              <option value="created_at">Sort by Date</option>
              <option value="name">Sort by Name</option>
              <option value="selling_price">Sort by Price</option>
              <option value="stock_quantity">Sort by Stock</option>
            </select>
            <button
              className="btn btn-outline-primary btn-sm"
              onClick={() => {
                setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              type="button"
            >
              {sortOrder === 'asc' ? 'Asc' : 'Desc'}
            </button>
          </div>
        </div>


        <div className="products-card">
          <div className="products-table-wrapper">
            <table className="products-table">
              <thead>
                <tr>
                  <th role="button" onClick={() => handleSortToggle('name')} className="sortable">
                    Product <span className="sort-indicator">{getSortIndicator('name')}</span>
                  </th>
                  <th role="button" onClick={() => handleSortToggle('company_name')} className="sortable">
                    Company <span className="sort-indicator">{getSortIndicator('company_name')}</span>
                  </th>
                  <th>Category</th>
                  <th role="button" onClick={() => handleSortToggle('selling_price')} className="sortable">
                    Selling Price <span className="sort-indicator">{getSortIndicator('selling_price')}</span>
                  </th>
                  <th role="button" onClick={() => handleSortToggle('stock_quantity')} className="sortable">
                    Stock <span className="sort-indicator">{getSortIndicator('stock_quantity')}</span>
                  </th>
                  <th>Expiry Date</th>
                  <th>Status</th>
                  {userDetails.role === 'admin' && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {isLoading && Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className="skeleton-row">
                    <td><span className="skeleton-block" /></td>
                    <td><span className="skeleton-block" /></td>
                    <td><span className="skeleton-block" /></td>
                    <td><span className="skeleton-block" /></td>
                    <td><span className="skeleton-block" /></td>
                    <td><span className="skeleton-block" /></td>
                    <td><span className="skeleton-block" /></td>
                    {userDetails.role === 'admin' && <td><span className="skeleton-block" /></td>}
                  </tr>
                ))}
                {!isLoading && errorMessage && (
                  <tr>
                    <td colSpan={userDetails.role === 'admin' ? 8 : 7} className="empty-state">
                      {errorMessage}
                    </td>
                  </tr>
                )}
                {!isLoading && !errorMessage && products.length === 0 && (
                  <tr>
                    <td colSpan={userDetails.role === 'admin' ? 8 : 7} className="empty-state">
                      No products found.
                    </td>
                  </tr>
                )}
                {!isLoading && !errorMessage && products.map((product) => {
                  const extra = extraDetailsByBarcode?.[product?.barcode] || {};
                  const displayProduct = { ...product, ...extra };
                  const stock = Number(displayProduct.stock_quantity ?? displayProduct.quantity ?? 0);
                  const minStock = Number(displayProduct.min_stock_level ?? 0);
                  const lowStock = minStock > 0 && stock <= minStock;
                  return (
                    <tr key={displayProduct.id || displayProduct.barcode} className="products-row">
                      <td>{displayProduct.name || displayProduct.product_name || '-'}</td>
                      <td>{displayProduct.company_name || displayProduct.company || '-'}</td>
                      <td>{displayProduct.category_name || displayProduct.category || '-'}</td>
                      <td>{formatMoney(displayProduct.selling_price)}</td>
                      <td>{stock}</td>
                      <td>{formatDate(displayProduct.expiry_date || displayProduct.expiryDate)}</td>
                      <td>
                        <span className={`stock-badge ${lowStock ? 'low' : 'ok'}`}>
                          {lowStock ? 'Low Stock' : 'In Stock'}
                        </span>
                      </td>
                      {userDetails.role === 'admin' && (
                        <td className="actions-cell">
                          <button className="btn btn-outline-primary btn-sm" onClick={() => handleEditClick(product)}>
                            Edit
                          </button>
                          <button className="btn btn-outline-danger btn-sm" onClick={() => openDeleteModal(product)}>
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="products-pagination">
            <button
              className="page-btn"
              disabled={pagination.page <= 1}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
            >
              Prev
            </button>
            <div className="page-list">
              {Array.from({ length: pagination.total_pages || 1 }, (_, idx) => idx + 1).map((page) => (
                <button
                  key={`page-${page}`}
                  className={`page-btn ${page === pagination.page ? 'active' : ''}`}
                  onClick={() => setPagination((prev) => ({ ...prev, page }))}
                >
                  {page}
                </button>
              ))}
            </div>
            <button
              className="page-btn"
              disabled={pagination.page >= pagination.total_pages}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
            >
              Next
            </button>
          </div>
        </div>

        {userDetails.role === 'admin' && (
          <AddProductModalComponent
            navigate={navigate}
            setProductUpdateFlag={setProductUpdateFlag}
            modalId="addProductModal"
            title="Add Product"
            fields={productFields}
            formData={formData}
            onChange={handleChange}
            onSubmit={handleSubmit}
            isSubmitting={isAddingProduct}
            onClose={() => setShowModal(false)}
            onProductAdded={fetchProducts}
          />
        )}
        {editTarget && (
          <EditProductModal
            item={editTarget}
            pieceBasedEnabled={pieceBasedEnabled}
            weightBasedEnabled={weightBasedEnabled}
            barcodeEnabled={barcodeEnabled}
            onClose={() => {
              setEditTarget(null);
              setEditDetailsStatus({ state: 'idle', message: '', source: 'indexeddb' });
            }}
            onSubmit={handleSubmitEdit}
            isSubmitting={isEditingProduct}
            detailsStatus={editDetailsStatus}
          />
        )}
        {deleteModalOpen && (
          <div className="delete-modal-overlay" onClick={closeDeleteModal}>
            <div className="delete-modal" onClick={(event) => event.stopPropagation()}>
              <h4>Delete product?</h4>
              <p>Are you sure you want to delete {deleteTarget?.name || deleteTarget?.product_name}?</p>
              <div className="delete-actions">
                <button className="btn btn-outline-secondary" onClick={closeDeleteModal}>
                  Cancel
                </button>
                <button className="btn btn-danger" onClick={handleDeleteProduct} disabled={deletingId === deleteTarget?.id}>
                  {deletingId === deleteTarget?.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductsPage;








