import React, { useEffect, useState } from 'react';

const CartItemRow = ({
  item,
  isSelected,
  isGSTEnabled,
  onSelect,
  onQtyChange,
  onPriceChange,
  onGstChange,
  onRemove,
}) => {
  const lineTotal = item.price * item.qty;
  const gstAmount = isGSTEnabled ? (lineTotal * item.gstPercent) / 100 : 0;
  const totalWithGst = lineTotal + gstAmount;
  const weightBased = item?.is_weight_based === true || String(item?.is_weight_based) === '1';
  const [qtyDraft, setQtyDraft] = useState(String(item.qty ?? ''));

  useEffect(() => {
    setQtyDraft(String(item.qty ?? ''));
  }, [item.qty]);

  const commitQty = () => {
    const trimmed = String(qtyDraft).trim();
    if (trimmed === '') {
      setQtyDraft(String(item.qty ?? 1));
      return;
    }
    onQtyChange(item.key, trimmed);
  };

  return (
    <tr
      className={`billing-row ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(item.key)}
    >
      <td>
        <div className="billing-name">
          <span>{item.name}</span>
          {Number.isFinite(item.__stock) && (
            <small className="billing-stock">Stock: {item.__stock}</small>
          )}
        </div>
      </td>
      <td className="qty-cell">
        <input
          className="form-control billing-qty-input"
          type="number"
          min="0"
          step={weightBased ? '0.01' : '1'}
          value={qtyDraft}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => setQtyDraft(event.target.value)}
          onBlur={commitQty}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              commitQty();
            }
          }}
        />
      </td>
      <td className="price-cell">
        <input
          className="form-control billing-price-input"
          type="number"
          min="0"
          value={item.price}
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => onPriceChange(item.key, event.target.value)}
        />
      </td>
      <td className="mrp-cell">{Number(item.mrp || 0).toFixed(2)}</td>
      <td className="gst-cell">{item.gstPercent || 0}%</td>
      <td>{totalWithGst.toFixed(2)}</td>
      <td className="remove-cell">
        <button
          type="button"
          className="btn btn-sm btn-outline-danger"
          onClick={(event) => {
            event.stopPropagation();
            onRemove(item.key);
          }}
        >
          Remove
        </button>
      </td>
    </tr>
  );
};

export default CartItemRow;
