import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './ProductsPage.css'; // Custom styles
import api from '../../utils/axios';
import { Modal } from 'bootstrap';
import AddProductModalComponent from './AddModalComponent/AddProductModalComponent';
import { useSelector } from 'react-redux';
import { saveProductsCache } from '../../utils/offlineProducts';
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
      await api.post('/products', payload); // Your endpoint
      // Optional: show success toast, close modal, refresh product list
      setFormData({
        product_name: '',
        company: '',
        category:'',
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
    { label: 'Quantity', name: 'stock_quantity', type: 'number' },
    { label: 'Time For Delivery', name:'time_for_delivery', type: 'number'},
    { label: 'Weight Based', name: 'is_weight_based', type: 'select', options: [
      ...(pieceBasedEnabled ? [{ label: 'No (Piece)', value: '0' }] : []),
      ...(weightBasedEnabled ? [{ label: 'Yes (Weight)', value: '1' }] : [])
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

  useEffect(() => {
    fetchCategories();
  }, []);

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

  const fetchProducts = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const response = await api.get('/products', { params: buildParams() });
      const payload = response?.data || {};
      const list = Array.isArray(payload.products) ? payload.products : [];
      setProducts(list);
      saveProductsCache(list);
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
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      let res;
      try {
        res = await api.get('/categories');
      } catch (innerErr) {
        res = await api.get('/orders/getcategories');
      }
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

  const handleEditClick = (product) => {
    setEditTarget(product);
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
      const payload = barcodeEnabled ? updatedProduct : (({ barcode, ...rest }) => rest)(updatedProduct);
      const response = await api.put(`/products/${updatedProduct.id}`, payload);
      if (response.status === 200) {
        showPopup('Product updated successfully!', 'Success');
        setEditTarget(null);
        setProductUpdateFlag((prev) => !prev);
      }
    } catch (error) {
      console.error('Failed to update product:', error);
      showPopup('Error updating product', 'Error');
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
          {userDetails.role === 'admin' && (
            <button className="btn btn-success" onClick={handleOpenModal}>
              Add Product
            </button>
          )}
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
                    {userDetails.role === 'admin' && <td><span className="skeleton-block" /></td>}
                  </tr>
                ))}
                {!isLoading && errorMessage && (
                  <tr>
                    <td colSpan={userDetails.role === 'admin' ? 7 : 6} className="empty-state">
                      {errorMessage}
                    </td>
                  </tr>
                )}
                {!isLoading && !errorMessage && products.length === 0 && (
                  <tr>
                    <td colSpan={userDetails.role === 'admin' ? 7 : 6} className="empty-state">
                      No products found.
                    </td>
                  </tr>
                )}
                {!isLoading && !errorMessage && products.map((product) => {
                  const stock = Number(product.stock_quantity ?? product.quantity ?? 0);
                  const minStock = Number(product.min_stock_level ?? 0);
                  const lowStock = minStock > 0 && stock <= minStock;
                  return (
                    <tr key={product.id} className="products-row">
                      <td>{product.name || product.product_name || '-'}</td>
                      <td>{product.company_name || product.company || '-'}</td>
                      <td>{product.category_name || product.category || '-'}</td>
                      <td>{formatMoney(product.selling_price)}</td>
                      <td>{stock}</td>
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
            onClose={() => setEditTarget(null)}
            onSubmit={handleSubmitEdit}
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
