import React from 'react';
import CartItemRow from './CartItemRow';

const CartList = ({
  items,
  selectedKey,
  isGSTEnabled,
  onSelect,
  onQtyChange,
  onPriceChange,
  onRemove,
}) => (
  <div className="billing-table-wrapper">
    <table className="billing-table">
      <thead>
        <tr>
          <th>Product</th>
          <th>Qty</th>
          <th>Price</th>
          <th>MRP</th>
          <th>GST %</th>
          <th>Total</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {items.length === 0 && (
          <tr>
            <td colSpan={7} className="billing-empty">
              Scan a product to start billing
            </td>
          </tr>
        )}
        {items.map((item) => (
          <CartItemRow
            key={item.key}
            item={item}
            isSelected={item.key === selectedKey}
            isGSTEnabled={isGSTEnabled}
            onSelect={onSelect}
            onQtyChange={onQtyChange}
            onPriceChange={onPriceChange}
            onRemove={onRemove}
          />
        ))}
      </tbody>
    </table>
  </div>
);

export default CartList;
