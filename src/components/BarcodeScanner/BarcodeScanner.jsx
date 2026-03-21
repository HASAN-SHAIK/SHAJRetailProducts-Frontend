import React, { useEffect, useRef, useState } from 'react';
import api from '../../utils/axios';
import { getProductByBarcode } from '../../core/db';
import { normalizeDisplayProduct } from '../../utils/localProductSearch';

const BarcodeScanner = () => {
  const inputRef = useRef(null);
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createData, setCreateData] = useState({
    product_name: '',
    category: '',
    company: '',
    selling_price: '',
    actual_price: '',
    stock_quantity: '',
    is_weight_based: '0',
    barcode: '',
  });

  useEffect(() => {
    const focusInput = () => inputRef.current?.focus();
    focusInput();
    const intervalId = setInterval(focusInput, 800);
    return () => clearInterval(intervalId);
  }, []);

  const resetAfterScan = () => {
    setBarcode('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleBarcodeSearch = async () => {
    const code = String(barcode || '').trim();
    if (!code || loading) return;
    setLoading(true);
    setProduct(null);
    setShowCreate(false);
    try {
      const localProduct = await getProductByBarcode(code);
      let payload = localProduct ? normalizeDisplayProduct(localProduct) : null;
      if (!payload) {
        const res = await api.get(`/products/barcode/${encodeURIComponent(code)}`);
        payload = res?.data || null;
        if (res?.data?.found === false) {
          payload = null;
        }
      }
      if (!payload) {
        setShowCreate(true);
        setCreateData((prev) => ({ ...prev, barcode: code }));
      } else {
        setProduct(payload || null);
      }
    } catch (err) {
      setShowCreate(true);
      setCreateData((prev) => ({ ...prev, barcode: code }));
    } finally {
      setLoading(false);
      resetAfterScan();
    }
  };

  const handleCreateChange = (e) => {
    const { name, value } = e.target;
    setCreateData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const payload = {
        name: createData.product_name,
        category: createData.category,
        company: createData.company,
        selling_price: createData.selling_price,
        actual_price: createData.actual_price,
        stock_quantity: createData.stock_quantity,
        is_weight_based: Number(createData.is_weight_based),
        barcode: createData.barcode,
      };
      const res = await api.post('/products', payload);
      setProduct(res?.data || null);
      setShowCreate(false);
    } catch (err) {
      // keep modal open so user can fix data
    } finally {
      setLoading(false);
      resetAfterScan();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-xl font-semibold">SHAJRetail Barcode Scanner</h1>

        <div className="flex gap-2">
          <input
            ref={inputRef}
            className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 outline-none focus:ring-2 focus:ring-cyan-400"
            placeholder="Scan barcode or enter product code"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleBarcodeSearch();
              }
            }}
            onBlur={() => inputRef.current?.focus()}
          />
          <button
            className="rounded-md bg-cyan-500 px-4 py-2 text-slate-900 font-semibold"
            onClick={handleBarcodeSearch}
            disabled={loading}
            type="button"
          >
            {loading ? 'Loading...' : 'Search'}
          </button>
        </div>

        {product && (
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
            <div className="text-lg font-semibold">{product.name}</div>
            <div className="text-sm text-slate-300">{product.company}</div>
            <div className="mt-2">
              <span className="font-semibold text-cyan-400">₹{product.selling_price}</span>
            </div>
            <div className="text-sm text-slate-400">Stock: {product.stock_quantity}</div>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg rounded-lg border border-slate-700 bg-slate-900 p-6">
            <h2 className="mb-3 text-lg font-semibold">Product not found</h2>
            <p className="mb-4 text-sm text-slate-300">
              Scanned Barcode: <span className="font-mono">{createData.barcode}</span>
            </p>

            <form onSubmit={handleCreateSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input
                name="product_name"
                placeholder="Product Name"
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:ring-2 focus:ring-cyan-400"
                value={createData.product_name}
                onChange={handleCreateChange}
              />
              <input
                name="category"
                placeholder="Category"
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:ring-2 focus:ring-cyan-400"
                value={createData.category}
                onChange={handleCreateChange}
              />
              <input
                name="company"
                placeholder="Company"
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:ring-2 focus:ring-cyan-400"
                value={createData.company}
                onChange={handleCreateChange}
              />
              <input
                name="selling_price"
                placeholder="Selling Price"
                type="number"
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:ring-2 focus:ring-cyan-400"
                value={createData.selling_price}
                onChange={handleCreateChange}
              />
              <input
                name="actual_price"
                placeholder="Actual Price"
                type="number"
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:ring-2 focus:ring-cyan-400"
                value={createData.actual_price}
                onChange={handleCreateChange}
              />
              <input
                name="stock_quantity"
                placeholder="Stock Quantity"
                type="number"
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:ring-2 focus:ring-cyan-400"
                value={createData.stock_quantity}
                onChange={handleCreateChange}
              />
              <select
                name="is_weight_based"
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:ring-2 focus:ring-cyan-400"
                value={createData.is_weight_based}
                onChange={handleCreateChange}
              >
                <option value="0">Piece Based</option>
                <option value="1">Weight Based</option>
              </select>
              <input
                name="barcode"
                placeholder="Barcode"
                className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none"
                value={createData.barcode}
                readOnly
              />

              <div className="col-span-1 mt-2 flex justify-end gap-2 md:col-span-2">
                <button
                  type="button"
                  className="rounded-md border border-slate-600 px-4 py-2"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-cyan-500 px-4 py-2 font-semibold text-slate-900"
                  disabled={loading}
                >
                  Create Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BarcodeScanner;
