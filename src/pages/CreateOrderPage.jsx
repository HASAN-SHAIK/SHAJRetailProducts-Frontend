import React, { useEffect, useState } from 'react';
import api from '../utils/axios';
import { useNavigate } from 'react-router-dom';
import { usePopup } from '../components/common/PopUp/PopupProvider';
import { useDispatch, useSelector } from 'react-redux';
import { clearOrderDetails, setOrderDetails } from '../store/orderSlice';
import { enqueueOfflineOrder } from '../utils/offlineOrders';
import { saveProductsCache, searchCachedProducts } from '../utils/offlineProducts';
import { loadCategoriesCache, saveCategoriesCache } from '../utils/offlineCategories';
import './CreateOrderPage.css';

const CreateOrderPage = () => {
  const [categories, setCategories] = useState([]);
  const [saleMethods, setSaleMethods] = useState(['sale', 'purchase', 'personal']);
  const userDetails = useSelector((state) => state.user.userDetails);
  const [transactionType, setTransactionType] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [products, setProducts] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [personalAmount, setPersonalAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const orderDetails = useSelector((state) => state.order.orderDetails);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { showPopup } = usePopup();
useEffect(() => {
  (async () => {
    try {
            // Remove 'personal' if not admin
      if (!orderDetails && userDetails.role !== 'admin') {
        setSaleMethods((prev) => prev.filter((method) => method !== 'personal'));
      }
      else if (orderDetails) {
        setSaleMethods((prev) => prev.filter((method) => method === 'sale'));
      }
      if(orderDetails){
        const reconstructedProducts = orderDetails.items.map(item => {
          const clonedItem = JSON.parse(JSON.stringify(item)); // deep clone

          return {
            ...clonedItem,
            id: clonedItem.product_id || clonedItem.id,
            suggestions: [],
            is_weight_based: clonedItem.is_weight_based ?? 0,
          };
        });
        setProducts(reconstructedProducts);
        setTransactionType(orderDetails.type);
        setTotalAmount(parseFloat(orderDetails.total_price));
        setPaymentMethod(orderDetails.payment);
        setPersonalAmount(orderDetails.personal_amount || '');
      }
      try {
        const res = await api.get('/orders/getcategories');
        setCategories(res.data);
        const payload = res?.data?.data || res?.data || [];
        saveCategoriesCache(payload);
      } catch (err) {
        const cached = loadCategoriesCache();
        if (cached.length) {
          setCategories({ data: cached });
        } else {
          throw err;
        }
      }

      if (navigator.onLine) {
        try {
          const productsRes = await api.get('/products');
          saveProductsCache(productsRes.data);
        } catch (err) {
          console.log('Failed to cache products for offline search', err);
        }
      }
      
    } catch (err) {
      const message = err?.response?.data?.message;
      const status = err?.response?.status || err?.status;
      if (
        navigator.onLine &&
        (message === 'Invalid Token' ||
          message === 'Access Denied' ||
          status == 400 ||
          status == 401 ||
          status == 403)
      ) {
        showPopup("Token Expired or Access Denied. Please Login Again!", "Session");
        navigate('/logout');
      } else {
        console.error("Failed to load categories:", err);
      }
    }
  })();
}, [orderDetails, userDetails.role, navigate, showPopup]);
useEffect(() => {
  if (!orderDetails) {
    dispatch(clearOrderDetails()); // Clear order details on mount when not editing
  }
}, [dispatch, orderDetails]);




  const handleTransactionTypeChange = (e) => {
    setTransactionType(e.target.value);
    setProducts([]);
    setTotalAmount(0);
    setPaymentMethod('');
    setPersonalAmount('');
  };

  const handlePaymentMethodChange = (e) => setPaymentMethod(e.target.value);

  const handleAddProductRow = () => {
    if (transactionType === 'sale') {
      setProducts([
        ...products,
        {
          product_name: '',
          id: null,
          quantity: '',
          suggestions: [],
          is_weight_based: 0,
          stock_quantity: null,
        },
      ]);
    } else if (transactionType === 'purchase') {
      setProducts([
        ...products,
        {
          product_name: '',
          company: '',
          quantity: '',
          actual_price: '',
          selling_price: '',
          category: '',
          time_for_delivery: '',
        },
      ]);
    }
  };

  const removeProductRow = (index) => {
    const updated = [...products];
    updated.splice(index, 1);
    setProducts(updated);
    calculateTotal(updated);
  };

  const handleSaleProductSearch = async (text, index) => {
    if (text.length < 2) return;
    try {
      if (!navigator.onLine) {
        const suggestions = searchCachedProducts(text);
        const updated = [...products];
        updated[index].suggestions = suggestions;
        setProducts(updated);
        return;
      }
      const response = await api.get(`/products/search?name=${text}`);
      const results = response?.data?.products || response?.data?.data || response?.data || [];
      const updated = [...products];
      updated[index].suggestions = Array.isArray(results) ? results : [];
      setProducts(updated);
    } catch (err) {
      const suggestions = searchCachedProducts(text);
      const updated = [...products];
      updated[index].suggestions = suggestions;
      setProducts(updated);
      if (navigator.onLine) {
        if ((err.response?.data && err.response.data.message === 'Invalid Token') || err.status === 400 || err.response?.status === 401 || err.response?.status === 403) {
          showPopup("Token Expired Please Login Again!", "Session");
          navigate('/logout');
        } else {
          console.log(err);
        }
      }
    }
  };

  const handleSaleProductSelect = (product, index) => {
    const updated = [...products];
    updated[index] = {
      product_name: product.name,
      id: product.id,
      quantity: '',
      suggestions: [],
      selling_price: product.selling_price,
      is_weight_based: product.is_weight_based ?? 0,
      stock_quantity: product.stock_quantity ?? null,
    };
    setProducts(updated);
    calculateTotal(updated);
  };

  const handlePurchaseProductSearch = async (text, index) => {
  if (text.length < 2) return;
  try {
    if (!navigator.onLine) {
      const suggestions = searchCachedProducts(text);
      const updated = [...products];
      updated[index].suggestions = suggestions;
      setProducts(updated);
      return;
    }
    const response = await api.get(`/products/search?name=${text}`);
    const results = response?.data?.products || response?.data?.data || response?.data || [];
    const updated = [...products];
    updated[index].suggestions = Array.isArray(results) ? results : [];
    setProducts(updated);
  } catch (err) {
    const suggestions = searchCachedProducts(text);
    const updated = [...products];
    updated[index].suggestions = suggestions;
    setProducts(updated);
    if (navigator.onLine) {
      if ((err.response?.data && err.response.data.message === 'Invalid Token') || err.status === 400 || err.response?.status === 401 || err.response?.status === 403) {
        showPopup("Token Expired Please Login Again!", "Session");
        navigate('/logout');
      } else {
        console.log(err);
      }
    }
  }
};

const handlePurchaseProductSelect = (product, index) => {
  const updated = [...products];
  updated[index] = {
    ...updated[index],
    product_name: product.name,
    company: product.company,
    quantity: 1,
    actual_price: product.actual_price,
    selling_price: product.selling_price,
    category: product.category,
    time_for_delivery: '',
    suggestions: [],
    is_weight_based: product.is_weight_based ?? 0,
    stock_quantity: product.stock_quantity ?? null,
  };
  setProducts(updated);
  calculateTotal(updated);
};

  const isWeightBasedProduct = (product) => Number(product?.is_weight_based) === 1;

  const isValidWeightInput = (value) => {
    if (value === '') return true;
    return /^\d+(\.\d{0,2})?$/.test(value);
  };

  const isValidPieceInput = (value) => {
    if (value === '') return true;
    return /^\d+$/.test(value);
  };

  const getProductTypeLabel = (product) => (isWeightBasedProduct(product) ? 'Weight' : 'Piece');

  const getQuantityPlaceholder = (product) =>
    isWeightBasedProduct(product) ? 'Weight (kg)' : 'Quantity (pcs)';

  const handleQuantityChange = (value, index) => {
    const updated = [...products];
    const current = updated[index] || {};
    const weightBased = isWeightBasedProduct(current);

    if (weightBased) {
      if (!isValidWeightInput(value)) {
        return;
      }
      const numeric = parseFloat(value);
      if (
        value !== '' &&
        Number.isFinite(numeric) &&
        current.stock_quantity != null &&
        current.stock_quantity !== '' &&
        numeric > Number(current.stock_quantity)
      ) {
        showPopup('Entered weight exceeds stock', 'Validation');
        return;
      }
      updated[index].quantity = value;
    } else {
      if (!isValidPieceInput(value)) {
        showPopup('Invalid input for piece item', 'Validation');
        return;
      }
      updated[index].quantity = value;
    }

    setProducts(updated);
    calculateTotal(updated);
  };

  const handlePurchaseFieldChange = (value, index, field) => {
    const updated = [...products];
    updated[index][field] = value;
    setProducts(updated);
    calculateTotal(updated);
  };
  

  const calculateTotal = (updatedProducts = products) => {
    if (transactionType === 'sale') {
      const total = updatedProducts.reduce((sum, p) => {
        return sum + (parseFloat(p.quantity || 0) * parseFloat(p.selling_price || 0));
      }, 0);
      setTotalAmount(total);
    } else if (transactionType === 'purchase') {
      const total = updatedProducts.reduce((sum, p) => {
        return sum + (parseFloat(p.quantity || 0) * parseFloat(p.actual_price || 0));
      }, 0);
      setTotalAmount(total);
    }
  };

  const handleSubmit = async (key) => {
    if(key === 0) {
      navigate('/orders');
      dispatch(clearOrderDetails());
      return;
    }
    if (!transactionType) {
      showPopup('Select transaction type', 'Validation');
      return;
    }

    if ((transactionType === 'sale' || transactionType === 'personal') && !paymentMethod)
      {
        showPopup('Select payment method', 'Validation');
        return;
      }

    if (transactionType === 'sale') {
      for (const p of products) {
        if (!p.id || p.quantity === '' || p.quantity == null) {
          showPopup('Select product and quantity', 'Validation');
          return;
        }
        const weightBased = isWeightBasedProduct(p);
        const rawValue = String(p.quantity);
        if (weightBased) {
          if (!isValidWeightInput(rawValue) || Number(p.quantity) <= 0) {
            showPopup('Select product and quantity', 'Validation');
            return;
          }
          if (
            p.stock_quantity != null &&
            p.stock_quantity !== '' &&
            Number(p.quantity) > Number(p.stock_quantity)
          ) {
            showPopup('Entered weight exceeds stock', 'Validation');
            return;
          }
        } else {
          if (!isValidPieceInput(rawValue) || Number(p.quantity) <= 0) {
            showPopup('Invalid input for piece item', 'Validation');
            return;
          }
        }
      }
    } else if (transactionType === 'purchase') {
      for (const p of products) {
        if (!p.product_name || !p.company || !p.quantity || !p.actual_price || !p.selling_price || !p.category || !p.time_for_delivery) {
          showPopup('Fill all product details', 'Validation');
          return;
        }
        if (p.selling_price < p.actual_price) {
          showPopup('Actual Price is Less than Selling price', 'Validation');
          return;
        }
      }
    } else if (transactionType === 'personal' && !personalAmount) {
      showPopup('Enter amount for personal transaction', 'Validation');
      return;
    }

    const updatePayload = {
        transaction_type: transactionType,
        type: transactionType,
        user_id: userDetails.id,
        total_amount: transactionType === 'personal' ? parseFloat(personalAmount) : totalAmount,
        total_price: transactionType === 'personal' ? parseFloat(personalAmount) : totalAmount,
        payment: paymentMethod,
        payment_method: paymentMethod,
        products: products.map(p => {
          if (transactionType === 'sale') {
            return {
              product_id: p.id,
              quantity: p.quantity,
              selling_price: p.selling_price,
              is_weight_based: p.is_weight_based ?? 0,
            };
          }
          if (transactionType === 'purchase') return { ...p };
          return {};
        }),
        items: products.map(p => {
          if (transactionType === 'sale') return { 
            product_id: p.id, 
            product_name: p.product_name,
            quantity: p.quantity, 
            selling_price: p.selling_price,
            price: p.selling_price,
            is_weight_based: p.is_weight_based ?? 0,
          };
          if (transactionType === 'purchase') return { ...p };
          return {};
        })
      };

    const createPayload = {
        transaction_type: transactionType,
        user_id: userDetails.id,
        total_amount: transactionType === 'personal' ? parseFloat(personalAmount) : totalAmount,
        payment_method: paymentMethod,
        products: products.map(p => {
          if (transactionType === 'sale') {
            return {
              product_id: p.id,
              quantity: p.quantity,
              selling_price: p.selling_price,
              is_weight_based: p.is_weight_based ?? 0,
            };
          }
          if (transactionType === 'purchase') return { ...p };
          return {};
        })
      };

    const enqueueAndExit = (isUpdate) => {
      const entry = isUpdate
        ? { type: 'update', orderId: orderDetails.id, payload: updatePayload }
        : { type: 'create', payload: createPayload };
      enqueueOfflineOrder(entry);
      showPopup('Offline: Order saved and will sync when you are online.', 'Offline');
      dispatch(clearOrderDetails());
      navigate('/orders');
    };

    try {

      if (!navigator.onLine) {
        enqueueAndExit(Boolean(orderDetails));
        return;
      }

      setIsLoading(true);
      if(orderDetails) {
        await api.put(`/orders/${orderDetails.id}`, updatePayload);
        dispatch(clearOrderDetails());
        navigate('/orders');
        showPopup('Order Updated!!', 'Success');
        return;
      }
      
      // For new orders
      await api.post('/orders', createPayload);
      showPopup('Order Placed!!', 'Success');
      navigate('/orders');
    } catch (err) {
      if (!err?.response) {
        enqueueAndExit(Boolean(orderDetails));
        return;
      }
      const message = err?.response?.data?.message;
      const status = err?.response?.status || err?.status;
      if (
        navigator.onLine &&
        (message === 'Invalid Token' ||
          status === 400 ||
          status === 401 ||
          status === 403)
      ) {
        showPopup("Token Expired Please Login Again!", "Session");
        navigate('/logout');
      } else {
        showPopup(message || "Please Enter valid Products/Details!", "Error");
        console.log(err);
      }
    }
    finally { 
      setIsLoading(false);
    }
  };
  

  return (
    <div className="create-order-page">
      <div className="wow-motion-layer" aria-hidden="true">
        <span className="wow-orb orb-a"></span>
        <span className="wow-orb orb-b"></span>
        <span className="wow-orb orb-c"></span>
        <span className="wow-orb orb-d"></span>
        <span className="wow-ring ring-a"></span>
        <span className="wow-ring ring-b"></span>
        <span className="wow-pulse"></span>
      </div>
      <div className="order-shell wow-content">
        <div className="order-hero">
          <div>
            <div className="order-kicker">Ameena Automobiles</div>
            <h3 className='order-title'>
              {orderDetails ? 'Update Order' : 'Create New Order'}
            </h3>
            <p className="order-subtitle">
              Build your order like a pro. Add products, set quantities, and checkout with confidence.
            </p>
          </div>
          <div className="order-hero-badge">
            Owner Mode
          </div>
        </div>
        <div className="order-card">
      <div className="mb-3">
        {saleMethods && saleMethods.map(type => (
          <label key={type} className="me-3">
            <input
              type="radio"
              value={type}
              checked={transactionType === type}
              onChange={handleTransactionTypeChange}
            /> {type}
          </label>
        ))}
      </div>

      {/* <div className="mb-3">
        <label>User Name:</label>
        <input className="form-control text-danger bg-light" value={userDetails.name} disabled />
      </div> */}

      {(transactionType === 'sale' || transactionType === 'personal' || transactionType === 'purchase') && (
        <div className="mb-3">
          <label>Payment Method:</label>
          <div>
            {['cash', 'online'].map(method => (
              <label key={method} className="me-3">
                <input
                  type="radio"
                  value={method}
                  checked={paymentMethod === method}
                  onChange={handlePaymentMethodChange}
                /> {method}
              </label>
            ))}
          </div>
        </div>
      )}

      {transactionType === 'sale' && products.map((p, index) => (
        <div className="row mb-2" key={index}>
          <div className="col-md-4">
            <input
              className="form-control bg-light text-dark"
              placeholder="Search Product"
              value={p.product_name}
              onChange={(e) => {
                const updated = [...products];
                updated[index].product_name = e.target.value;
                setProducts(updated);
                handleSaleProductSearch(e.target.value, index);
              }}
            />
            {p.id && (
              <div className="mt-2">
                <span className={`product-type-badge ${isWeightBasedProduct(p) ? 'badge-weight' : 'badge-piece'}`}>
                  [{getProductTypeLabel(p)}]
                </span>
              </div>
            )}
            {p.suggestions?.length > 0 && (
              <ul className="list-group">
                {p.suggestions.map((s, i) => (
                  (s.stock_quantity == null || Number(s.stock_quantity) > 0) ?
                    <li
                      key={i}
                      className="list-group-item list-group-item-action"
                      onClick={() => handleSaleProductSelect(s, index)}
                    >
                      <div className="d-flex justify-content-between align-items-center gap-2">
                        <span>{s.name + " - " + s.company + '(Rs. ' + s.selling_price + ')'}</span>
                        <span className={`product-type-badge ${Number(s.is_weight_based) === 1 ? 'badge-weight' : 'badge-piece'}`}>
                          [{Number(s.is_weight_based) === 1 ? 'Weight' : 'Piece'}]
                        </span>
                      </div>
                    </li>
                    : <li className="list-group-item list-group-item-action text-danger" disabled>
                      {s.name + '(Out Of Stock)'}
                    </li>
                ))}
              </ul>
            )}
          </div>
          <div className="col-md-2">
            {/* <label className="form-label small text-uppercase text-muted">
              {isWeightBasedProduct(p) ? 'Weight (kg)' : 'Quantity (pcs)'}
            </label> */}
            <input
              type="number"
              className="form-control bg-light text-dark"
              placeholder={getQuantityPlaceholder(p)}
              value={p.quantity}
              onChange={(e) => handleQuantityChange(e.target.value, index)}
              disabled={!p.id}
              step={isWeightBasedProduct(p) ? '0.01' : '1'}
              inputMode={isWeightBasedProduct(p) ? 'decimal' : 'numeric'}
              data-testid="sale-quantity-input"
            />
            {isWeightBasedProduct(p) && (
              <small className="form-text text-white weight-helper">
                Use decimal for kg, e.g., 1.25
              </small>
            )}
          </div>
          <div className="col-md-1 d-flex align-items-center">
            <button className="btn btn-danger btn-sm" onClick={() => removeProductRow(index)}>×</button>
          </div>
        </div>
      ))}

  {transactionType === 'purchase' && products.map((p, index) => (
  <div className="row mb-2" key={index}>
    {['product_name', 'company', 'quantity', 'actual_price', 'selling_price', 'category', 'time_for_delivery'].map((field) => (
      <div className="col" key={field}>
        {field === 'product_name' ? (
          <>
            <input
              className="form-control"
              placeholder="Product Name"
              value={p.product_name}
              onChange={(e) => {
                handlePurchaseFieldChange(e.target.value, index, 'product_name');
                handlePurchaseProductSearch(e.target.value, index);
              }}
            />
            {p.suggestions?.length > 0 && (
              <ul className="list-group">
                {p.suggestions.map((s, i) => (
                  <li
                    key={i}
                    className="list-group-item list-group-item-action"
                    onClick={() => handlePurchaseProductSelect(s, index)}
                  >
                    {s.name} - {s.company} (₹{s.actual_price})
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : field === 'category' ? (
          <>
            <input
              list="categories-list"
              className="form-control"
              placeholder="Category"
              value={p.category}
              onChange={(e) => handlePurchaseFieldChange(e.target.value, index, 'category')}
            />
            <datalist id="categories-list">
              {categories.data && categories.data.map((cat, idx) => (
                <option key={idx} value={cat.category} />
              ))}
            </datalist>
          </>
        ) : (
          <input
            className="form-control"
            placeholder={field.replace(/_/g, ' ')}
            value={p[field]}
            onChange={(e) => handlePurchaseFieldChange(e.target.value, index, field)}
          />
        )}
      </div>
    ))}
    <div className="col-1 d-flex align-items-center">
      <button className="btn btn-danger btn-sm" onClick={() => removeProductRow(index)}>×</button>
    </div>
  </div>
))}


      {transactionType && transactionType !== 'personal' && (
        <div className="mb-3">
          <button className="btn btn-success" onClick={handleAddProductRow}>Add Product</button>
        </div>
      )}

      {transactionType === 'personal' && (
        <div className="mb-3">
          <label>Total Amount:</label>
          <input
            type="number"
            className="form-control"
            value={personalAmount}
            onChange={(e) => setPersonalAmount(e.target.value)}
          />
        </div>
      )}

      {(transactionType === 'sale' || transactionType === 'purchase') && (
        <div className="mb-3">
          <strong>Total: ₹{totalAmount.toFixed(2)}</strong>
        </div>
      )}

      <div className="order-actions">
        <button className="btn btn-danger m-1 order-btn" onClick={()=>handleSubmit(0)}>
          { isLoading ? <div class="spinner-border spinner-style text-light" role="status"></div> : `Cancel`}
        </button>
        <button className="btn btn-primary m-1 order-btn order-btn-primary" onClick={()=>handleSubmit(1)}>
          {isLoading ? (
            <div class="spinner-border spinner-style text-light" role="status"></div>
          ) : (
            orderDetails ? 'Update Order' : 'Create Order'
          )}
        </button>
      </div>
        </div>
      </div>
    </div>
  );
};

export default CreateOrderPage;
