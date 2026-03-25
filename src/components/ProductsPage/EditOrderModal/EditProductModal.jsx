import React, { useState, useEffect } from 'react';
import './EditProductModal.css';

const EditProductModal = ({ item, onClose, onSubmit, pieceBasedEnabled = true, weightBasedEnabled = true, barcodeEnabled = false, isSubmitting = false, detailsStatus = {} }) => {
  useEffect(() => {
    // Add Google Font (Orbitron - a cool tech font)
    const link = document.createElement("link");
    link.href =
      "https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }, []);

  const formatExpiryDate = (value) => {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  };

  const [productName, setProductName] = useState(item.name || item.product_name || '');
  const [sellingPrice, setSellingPrice] = useState(item.selling_price);
  const [actualPrice, setActualPrice] = useState(item.actual_price);
  const [stockQuantity, setStockQuantity] = useState(
    item.stock_quantity ?? item.quantity ?? item.stock ?? ''
  );
  const [expiryDate, setExpiryDate] = useState(formatExpiryDate(item.expiry_date ?? item.expiryDate));
  const [companyName, setCompanyName] = useState(
    item.company || item.company_name || item.brand || ''
  );
  const [barcode, setBarcode] = useState(item.barcode || '');
  const [hasTouched, setHasTouched] = useState(false);

  const isWeightBasedValue = (value) => {
    if (value === true) return true;
    if (value === false || value == null) return false;
    if (typeof value === 'number') return value === 1;
    const normalized = value.toString().trim().toLowerCase();
    return ['1', 'true', 'yes', 'y', 'weight', 'weighted', 'kg'].includes(normalized);
  };

  const deriveIsWeightBased = (sourceItem) => {
    const weightSource =
      sourceItem?.is_weight_based ??
      sourceItem?.type ??
      sourceItem?.product_type ??
      sourceItem?.unit ??
      sourceItem?.unit_type ??
      sourceItem?.measure;
    return isWeightBasedValue(weightSource) ||
      (typeof sourceItem?.name === 'string' && sourceItem.name.toLowerCase().includes('kg')) ||
      (typeof sourceItem?.product_name === 'string' && sourceItem.product_name.toLowerCase().includes('kg'))
      ? '1'
      : '0';
  };

  const [isWeightBased, setIsWeightBased] = useState(deriveIsWeightBased(item));

  const syncFromItem = (sourceItem) => {
    if (!sourceItem) return;
    setProductName(sourceItem.name || sourceItem.product_name || '');
    setSellingPrice(sourceItem.selling_price);
    setActualPrice(sourceItem.actual_price);
    setStockQuantity(sourceItem.stock_quantity ?? sourceItem.quantity ?? sourceItem.stock ?? '');
    setExpiryDate(formatExpiryDate(sourceItem.expiry_date ?? sourceItem.expiryDate));
    setCompanyName(sourceItem.company || sourceItem.company_name || sourceItem.brand || '');
    setBarcode(sourceItem.barcode || '');
    setIsWeightBased(deriveIsWeightBased(sourceItem));
  };

  useEffect(() => {
    setHasTouched(false);
    syncFromItem(item);
  }, [item?.id]);

  useEffect(() => {
    if (hasTouched) return;
    syncFromItem(item);
  }, [item, hasTouched]);


  const handlePriceChange = (value, index = 0) => {
    setHasTouched(true);
    index === 0?setActualPrice(value): index == 1? setSellingPrice(value): setStockQuantity(value);
  };


  const handleSubmit = () => {
    if (isSubmitting) return;
    if (!pieceBasedEnabled && isWeightBased === '0') return;
    if (!weightBasedEnabled && isWeightBased === '1') return;
    const updatedProduct = {
      name: productName,
      product_name: productName,
      company: companyName,
      barcode: barcodeEnabled ? barcode : undefined,
      selling_price: sellingPrice,
      actual_price:actualPrice,
      stock_quantity: stockQuantity,
      expiry_date: expiryDate || null,
      is_weight_based: isWeightBased,
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
        {detailsStatus?.message && (
          <div className={`edit-details-banner ${detailsStatus.state || ''}`}>
            <span>{detailsStatus.message}</span>
            <span className="details-source">
              Source: {detailsStatus.source === 'server' ? 'Server' : 'IndexedDB'}
            </span>
          </div>
        )}
        <form className="d-flex flex-column align-items-center">
          <div className="form-group w-100 mb-3 text-center">
            <label className="form-label w-100">Product Name</label>
            <input
              className="form-control text-center neon-input"
              type="text"
              value={productName}
              onChange={(e) => {
                setHasTouched(true);
                setProductName(e.target.value);
              }}
            />
          </div>

          <div className="form-group w-100 mb-3 text-center">
            <label className="form-label w-100">Company</label>
            <input
              className="form-control text-center neon-input"
              type="text"
              value={companyName}
              onChange={(e) => {
                setHasTouched(true);
                setCompanyName(e.target.value);
              }}
            />
          </div>
          {barcodeEnabled && (
            <div className="form-group w-100 mb-3 text-center">
              <label className="form-label w-100">Barcode</label>
              <input
                className="form-control text-center neon-input"
              type="text"
              value={barcode}
              onChange={(e) => {
                setHasTouched(true);
                setBarcode(e.target.value);
              }}
            />
          </div>
          )}

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

          <div className="form-group w-100 mb-4 text-center">
            <label className="form-label w-100">Expiry Date</label>
            <input
              className="form-control text-center neon-input"
              type="date"
              value={expiryDate}
              onChange={(e) => {
                setHasTouched(true);
                setExpiryDate(e.target.value);
              }}
            />
          </div>

          <div className="form-group w-100 mb-4 text-center">
            <label className="form-label w-100">Type</label>
            <select
              className="form-control text-center neon-input"
              value={isWeightBased}
              onChange={(e) => {
                setHasTouched(true);
                setIsWeightBased(e.target.value);
              }}
            >
              {pieceBasedEnabled && <option value="0">Piece-based</option>}
              {weightBasedEnabled && <option value="1">Weight-based</option>}
            </select>
            {!pieceBasedEnabled && (
              <small className="form-text text-warning">Piece-based products are disabled.</small>
            )}
            {!weightBasedEnabled && (
              <small className="form-text text-warning">Weight-based products are disabled.</small>
            )}
          </div>

          <div className="d-flex justify-content-between w-100">
            <button
              className="btn btn-outline-danger w-45"
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              className="btn btn-outline-success w-45"
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>

  );
};

export default EditProductModal;





