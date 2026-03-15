const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const ProductItem = ({ product }) => {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-2.5 py-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-white">{product.name}</p>
        <p className="text-[11px] font-semibold text-white">
          ₹{formatCurrency(product.price)}
        </p>
      </div>
      <div className="mt-1 flex items-center justify-between text-[9px] text-white/60">
        <span>Stock: {product.stock}</span>
        {product.barcode ? <span>Barcode: {product.barcode}</span> : <span>No barcode</span>}
      </div>
    </div>
  );
};

export default ProductItem;
