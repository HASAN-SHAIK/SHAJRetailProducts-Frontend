import React, { useState, useEffect } from 'react';
import './EditProductModal.css';

const EditProductModal = ({ item, onClose, onSubmit }) => {
  useEffect(() => {
    // Add Google Font (Orbitron - a cool tech font)
    const link = document.createElement("link");
    link.href =
      "https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);

  const [productName, setProductName] = useState(item.name || item.product_name || '');
  const [sellingPrice, setSellingPrice] = useState(item.selling_price);
  const [actualPrice, setActualPrice] = useState(item.actual_price);
  const [stockQuantity, setStockQuantity] = useState(item.quantity)
  const [companyName, setCompanyName] = useState(item.company || '');


  const handlePriceChange = (value, index = 0) => {
    index === 0?setActualPrice(value): index == 1? setSellingPrice(value): setStockQuantity(value);
  };


  const handleSubmit = () => {
    const updatedProduct = {
      name: productName,
      product_name: productName,
      company: companyName,
      selling_price: sellingPrice,
      actual_price:actualPrice,
      stock_quantity: stockQuantity,
      id: item.id
    };
    onSubmit(updatedProduct);
  };

  if (!item) return null;
    

  return (
    <div className="modal-overlay edit-product-modal d-flex justify-content-center align-items-center">
      <div
        className="modal-content p-4 text-white shadow"
      >
        <h3 className="text-center mb-4 text-info">Edit Product</h3>
        <form className="d-flex flex-column align-items-center">
          <div className="form-group w-100 mb-3 text-center">
            <label className="form-label w-100">Product Name</label>
            <input
              className="form-control text-center neon-input"
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
            />
          </div>

          <div className="form-group w-100 mb-3 text-center">
            <label className="form-label w-100">Company</label>
            <input
              className="form-control text-center neon-input"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>

          <div className="form-group w-100 mb-3 text-center">
            <label className="form-label w-100">Actual Price</label>
            <input
              className="form-control text-center neon-input"
              type="number"
              value={actualPrice}
              onChange={(e) => handlePriceChange(e.target.value)}
            />
          </div>

          <div className="form-group w-100 mb-3 text-center">
            <label className="form-label w-100">Selling Price</label>
            <input
              className="form-control text-center neon-input"
              type="number"
              value={sellingPrice}
              onChange={(e) => handlePriceChange(e.target.value, 1)}
            />
          </div>

          <div className="form-group w-100 mb-4 text-center">
            <label className="form-label w-100">Stock Quantity</label>
            <input
              className="form-control text-center neon-input"
              type="number"
              value={stockQuantity}
              onChange={(e) => handlePriceChange(e.target.value, 2)}
            />
          </div>

          <div className="d-flex justify-content-between w-100">
            <button
              className="btn btn-outline-danger w-45"
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="btn btn-outline-success w-45"
              type="button"
              onClick={handleSubmit}
            >
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>

  );
};

export default EditProductModal;
