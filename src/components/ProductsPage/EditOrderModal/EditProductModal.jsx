import React, { useState, useEffect } from 'react';
import './EditProductModal.css';
import '../AddModalComponent/AddProductModalComponent.css';

const EditProductModal = ({ item, onClose, onSubmit, pieceBasedEnabled = true, weightBasedEnabled = true, barcodeEnabled = false, isSubmitting = false, detailsStatus = {} }) => {
  const formatExpiryDate = (value) => {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  };

  const [productName, setProductName] = useState(item.name || item.product_name || '');
  const [sellingPrice, setSellingPrice] = useState(item.selling_price);
  const [purchasePrice, setPurchasePrice] = useState(item.purchase_price);
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
    setPurchasePrice(sourceItem.purchase_price);
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
    index === 0 ? setPurchasePrice(value) : index === 1 ? setSellingPrice(value) : setStockQuantity(value);
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
      purchase_price: purchasePrice,
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
      <div className="modal-dialog modal-dialog-centered custom-modal-width">
        <div className="modal-content custom-modal">
          <div className="modal-header border-0">
            <h5 className="modal-title fw-bold text-primary">
              Edit Product{productName ? ` - ${productName}` : ''}
            </h5>
            <button
              type="button"
              className="btn-close btn-close-white custom-close bg-danger position-absolute end-0 m-4"
              aria-label="Close"
              onClick={onClose}
              disabled={isSubmitting}
            ></button>
          </div>
          <div className="modal-body">
        {detailsStatus?.message && (
          <div className={`edit-details-banner ${detailsStatus.state || ''}`}>
            <span>{detailsStatus.message}</span>
            <span className="details-source">
              Source: {detailsStatus.source === 'server' ? 'Server' : 'IndexedDB'}
            </span>
          </div>
        )}
        <form className="d-flex flex-column align-items-center">
          <div className="form-group w-100 mb-3">
            <label className="form-label text-light">Product Name</label>
            <input
              className="form-control custom-input"
              type="text"
              value={productName}
              onChange={(e) => {
                setHasTouched(true);
                setProductName(e.target.value);
              }}
            />
          </div>

          <div className="form-group w-100 mb-3">
            <label className="form-label text-light">Company</label>
            <input
              className="form-control custom-input"
              type="text"
              value={companyName}
              onChange={(e) => {
                setHasTouched(true);
                setCompanyName(e.target.value);
              }}
            />
          </div>
          {barcodeEnabled && (
            <div className="form-group w-100 mb-3">
              <label className="form-label text-light">Barcode</label>
              <input
                className="form-control custom-input"
              type="text"
              value={barcode}
              onChange={(e) => {
                setHasTouched(true);
                setBarcode(e.target.value);
              }}
            />
          </div>
          )}

          <div className="form-group w-100 mb-3">
            <label className="form-label text-light">Purchase Price</label>
            <input
              className="form-control custom-input"
              type="number"
              value={purchasePrice}
              onChange={(e) => handlePriceChange(e.target.value)}
            />
          </div>

          <div className="form-group w-100 mb-3">
            <label className="form-label text-light">Selling Price</label>
            <input
              className="form-control custom-input"
              type="number"
              value={sellingPrice}
              onChange={(e) => handlePriceChange(e.target.value, 1)}
            />
          </div>

          <div className="form-group w-100 mb-4">
            <label className="form-label text-light">Stock Quantity</label>
            <input
              className="form-control custom-input"
              type="number"
              value={stockQuantity}
              onChange={(e) => handlePriceChange(e.target.value, 2)}
            />
          </div>

          <div className="form-group w-100 mb-4">
            <label className="form-label text-light">Expiry Date</label>
            <input
              className="form-control custom-input"
              type="date"
              value={expiryDate}
              onChange={(e) => {
                setHasTouched(true);
                setExpiryDate(e.target.value);
              }}
            />
          </div>

          <div className="form-group w-100 mb-4">
            <label className="form-label text-light">Type</label>
            <select
              className="form-select custom-input"
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

          <div className="modal-footer border-0">
            <button
              className="btn btn-light custom-btn"
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary custom-btn"
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
          </div>
        </div>
      </div>
    </div>

  );
};

export default EditProductModal;







