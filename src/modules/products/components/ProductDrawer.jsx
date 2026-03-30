import React from 'react';
import Button from '../../../ui/Button';

const ProductDrawer = ({ open, onClose, product }) => {
  if (!open) return null;
  return (
    <div className="order-drawer-overlay" onClick={onClose}>
      <aside className="order-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <h4>{product?.name || product?.product_name || 'Product'}</h4>
          <Button variant="outline-secondary" onClick={onClose}>Close</Button>
        </div>
        <div className="drawer-content">
          <p>MRP: {product?.mrp || '-'}</p>
          <p>Selling: {product?.selling_price || '-'}</p>
          <p>GST: {product?.gst_percentage || product?.gst_percent || 0}%</p>
        </div>
      </aside>
    </div>
  );
};

export default ProductDrawer;
