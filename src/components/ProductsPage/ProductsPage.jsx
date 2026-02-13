import React, { useState, useEffect } from 'react';
import './ProductsPage.css'; // Custom styles
import TableComponent from '../common/TableComponent/TableComponent';
import api from '../../utils/axios';
import { Modal } from 'bootstrap';
import AddProductModalComponent from './AddModalComponent/AddProductModalComponent';
import LoadingSpinner from '../common/LoadingSpinner/LoadingSpinner';
import { useSelector } from 'react-redux';
import { saveProductsCache } from '../../utils/offlineProducts';
import { usePopup } from '../common/PopUp/PopupProvider';

const ProductsPage = ({ navigate }) => {
//Modal data
 const [showEditModal, setShowEditModal] = useState(false);
 const [selectedOrder, setSelectedOrder] = useState(null);
 const [productUpdateFlag, setProductUpdateFlag] = useState(false);
 const userDetails = useSelector((state) => state.user.userDetails);
 const { showPopup } = usePopup();
 const [formData, setFormData] = useState({
  product_name: '',
    company: '',
    selling_price: '',
    actual_price: '',
    stock_quantity: '',
    category: '',
    time_for_delivery: '',
    is_weight_based: '0'
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEditClick = (order) => {
    setSelectedOrder(order);
    setShowEditModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await api.post('/products', formData); // Your endpoint
      // Optional: show success toast, close modal, refresh product list
      setFormData({
        product_name: '',
        company: '',
        category:'',
        selling_price: '',
        actual_price: '',
        stock_quantity: '',
        time_for_delivery: '',
        is_weight_based: '0'
      });
      const modalElement = document.getElementById('addProductModal');
      const modal = Modal.getInstance(modalElement);
      modal.hide();
      showPopup("Product added successfully!", "Success");
    setProductUpdateFlag(true)

    } catch (err) {
      if(err.response.data.message === 'Invalid Token' || err.response.data.message === 'Access Denied' || err.response.status === 401 || err.response.status === 403 || err.response.status === 400){
      showPopup("Token Expired Please Login Again!", "Session");
      navigate('/logout');
      }
      else if(err.status === 403){
      showPopup("You should be admin", "Access");     
      }
      else{
      showPopup("Issue while adding please try later", "Error");
      console.error('Error adding product:', err);
      }
    }
    
  };

  const productFields = [
    { label: 'Product Name', name: 'product_name' },
    { label: 'Company', name: 'company' },
    { label: 'Category', name: 'category', type: 'datalist' },
    { label: 'Selling Price', name: 'selling_price', type: 'number' },
    { label: 'Actual Price', name: 'actual_price', type: 'number' },
    { label: 'Quantity', name: 'stock_quantity', type: 'number' },
    { label: 'Time For Delivery', name:'time_for_delivery', type: 'number'},
    { label: 'Weight Based', name: 'is_weight_based', type: 'select', options: [
      { label: 'No (Piece)', value: '0' },
      { label: 'Yes (Weight)', value: '1' }
    ]},
  ];

 const [products, setProducts] = useState([]);
 const [searchTerm, setSearchTerm] = useState('');
 const [searchCategory, setSearchCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [sortBy, setSortBy] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProducts().then(()=> setIsLoading(false));
    fetchCategories();
  }, [productUpdateFlag]);

  const fetchProducts = async () => {
    try{
    const response = await api.get('/products');
    setProducts(response.data);
    saveProductsCache(response.data);
    }
    catch(err){
     if(err.response?.data?.message === 'Invalid Token' || err.response.status === 400 || err.response.status === 401 || err.response.status === 403){
      showPopup("Token Expired Please Login Again!", "Session");
      navigate('/logout');
      }
      else{
        console.log(err);
      }
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/orders/getcategories');
      const list = Array.isArray(res.data?.data)
        ? res.data.data.map((c) => c.category).filter(Boolean)
        : Array.isArray(res.data)
          ? res.data.map((c) => c.category).filter(Boolean)
          : [];
      setCategories(list);
    } catch (err) {
      if (err.response?.data?.message === 'Invalid Token' || err.response?.status === 400 || err.response?.status === 401 || err.response?.status === 403) {
        showPopup("Token Expired Please Login Again!", "Session");
        navigate('/logout');
      } else {
        console.log("Failed to load categories", err);
      }
    }
  };

  const handleSearch = (e) => setSearchTerm(e.target.value);
  const handleCategorySearch = (e) => setSearchCategory(e.target.value);

  const handleSort = (e) => setSortBy(e.target.value);

  const normalizeCategory = (value) => {
    if (value == null) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'object') {
      return (
        value.category ||
        value.name ||
        value.title ||
        value.label ||
        ''
      ).toString().trim();
    }
    return value.toString().trim();
  };

  const categoryOptions = Array.from(
    new Set(
      (categories.length ? categories : products.map((p) => p.category))
        .map(normalizeCategory)
        .filter(Boolean)
    )
  );

  const filteredProducts = products
    .filter((p) => {
      const term = searchTerm.toLowerCase();
      const nameMatch = (p.name || '').toLowerCase().includes(term);
      const companyMatch = (p.company || '').toLowerCase().includes(term);
      return nameMatch || companyMatch;
    })
    .filter((p) => {
      if (!searchCategory) return true;
      const productCategory = normalizeCategory(p.category);
      return productCategory.toLowerCase() === searchCategory.toLowerCase();
    })
    .sort((a, b) => {
      if (!sortBy) return 0;
      return a[sortBy].localeCompare(b[sortBy]);
    });
    const handleOpenModal = () => {
        const modalElement = document.getElementById('addProductModal');
        const bootstrapModal = new Modal(modalElement);
        setShowModal(true);
        bootstrapModal.show();
    }

  return (
    <div className="wow-page">
      <div className="wow-motion-layer" aria-hidden="true">
        <span className="wow-orb orb-a"></span>
        <span className="wow-orb orb-b"></span>
        <span className="wow-orb orb-c"></span>
        <span className="wow-orb orb-d"></span>
        <span className="wow-ring ring-a"></span>
        <span className="wow-ring ring-b"></span>
        <span className="wow-pulse"></span>
      </div>
      <div className="wow-content w-90 container-fluid pt-4">
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <>
            {userDetails.role === 'admin' && (
              <div className="d-flex float-end">
                <div>
                  <button className="btn btn-success form-control" onClick={() => handleOpenModal(true)}>
                    Add Product
                  </button>
                </div>
              </div>
            )}

            <div className="d-flex mb-3 gap-3">
              <input className="w-60 form-control" placeholder="Search Products. . . ." value={searchTerm} onChange={handleSearch} />
              <select className="form-select w-40" value={searchCategory} onChange={handleCategorySearch}>
                <option value="">All Categories</option>
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <select className="form-select w-50 mx-3" onChange={handleSort}>
                <option value="">Sort by</option>
                <option value="name">Name</option>
                <option value="company">Company</option>
              </select>
            </div>

            <TableComponent
              columns={['Name', 'Company', 'Type', 'Selling_Price', ...(userDetails.role === 'admin' ? ['Actual_Price'] : []), 'Quantity', ...(userDetails.role === 'admin' ? ['Edit'] : [])]}
              data={filteredProducts}
              isAdmin={userDetails.role === 'admin'}
              setProductUpdateFlag={setProductUpdateFlag}
            />

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
                onClose={() => setShowModal(false)}
                onProductAdded={fetchProducts}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ProductsPage;
