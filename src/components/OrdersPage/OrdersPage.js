import React, { useState, useEffect } from 'react';
import { formatIstDate, formatIstDateTime } from '../../utils/date';
import api from '../../utils/axios'; // assuming custom axios instance
import './OrdersPage.css'; // optional custom styles
import TableComponent from '../common/TableComponent/TableComponent';
import EditOrderModal from './EditOrderModal/EditOrderModal';
import LoadingSpinner from '../common/LoadingSpinner/LoadingSpinner';
import { setOrderDetails } from '../../store/orderSlice';
import { useDispatch } from 'react-redux';
import { usePopup } from '../common/PopUp/PopupProvider';
import { getOfflineOrderQueue, processOfflineQueue } from '../../utils/offlineOrders';
const OrdersPage = ({ userRole, navigate }) => {
 const columns = ["OrderId", "Products", "Price", "TotalPrice", "ByUser", "Date", "Edit"]
 const [orders, setOrders] = useState([]);
 const [filteredOrders, setFilteredOrders] = useState([]);
 const [search, setSearch] = useState('');
 const [sortBy, setSortBy] = useState('orderId');
 const [orderUpdateFlag, setOrderUpdateFlag] = useState(0);
 const [deletedOrderIds, setDeletedOrderIds] = useState(new Set());
 const [showEditModal, setShowEditModal] = useState(false);
 const [selectedOrder, setSelectedOrder] = useState(null);
 const [orderId, setOrderId] = useState(null);
 const [isLoading, setIsLoading] = useState(true);
 const [offlineOrders, setOfflineOrders] = useState([]);
 const [isSyncing, setIsSyncing] = useState(false);
 const [shopDetails, setShopDetails] = useState(null);
  const dispatch = useDispatch();
  const { showPopup } = usePopup();

 const formatToIST = (utcDate) => {
  if (!utcDate) return '';
  const date = new Date(utcDate);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
 };

 const calculateSubtotal = (order) => {
  if (!order?.items?.length) return 0;
  return order.items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity || 0);
    const price = parseFloat(item.selling_price || item.price || 0);
    return sum + qty * price;
  }, 0);
 };

 const formatItemQuantityPlain = (item) => {
  const weightBased = Number(item?.is_weight_based) === 1;
  const qty = Number(item?.quantity || 0);
  if (!Number.isFinite(qty)) return weightBased ? '0.00 kg' : '0 pcs';
  const qtyValue = weightBased ? qty.toFixed(2) : Math.trunc(qty).toString();
  return weightBased ? `${qtyValue} kg` : `${qtyValue} pcs`;
 };

 const formatItemDisplay = (item) => {
  const weightBased = Number(item?.is_weight_based) === 1;
  return weightBased
    ? `Weight: ${formatItemQuantityPlain(item)}`
    : `Qty: ${formatItemQuantityPlain(item)}`;
 };

 const fetchShopDetails = async () => {
  try {
    const res = await api.get('/shop-details/me');
    const details = res?.data?.shop_details || null;
    setShopDetails(details);
    return details;
  } catch (err) {
    return null;
  }
 };

 const downloadGstReceipt = async (order) => {
  if (!order) return;
  const details = shopDetails || await fetchShopDetails();
  const subtotal = calculateSubtotal(order);
  const sgstRate = 0.09;
  const cgstRate = 0.09;
  const sgst = subtotal * sgstRate;
  const cgst = subtotal * cgstRate;
  const grandTotal = subtotal + sgst + cgst;

  const itemsRows = (order.items || []).map((item, idx) => {
    const qty = parseFloat(item.quantity || 0);
    const price = parseFloat(item.selling_price || item.price || 0);
    const lineTotal = qty * price;
    return `
      <tr>
        <td>${idx + 1}</td>
        <td>${item.product_name || 'Item'}</td>
        <td>${formatItemQuantityPlain(item)}</td>
        <td>₹${price.toFixed(2)}</td>
        <td>₹${lineTotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  const shopName = details?.shop_name || 'SHAJ Retail Products';
  const ownerName = details?.owner_name || '';
  const gstNumber = details?.gst_number || '27ABCDE1234F1Z5';
  const panNumber = details?.pan_number || '';
  const addressLine = details?.address_line || 'Customer Address (Dummy)';
  const city = details?.city || 'City';
  const state = details?.state || 'State';
  const pincode = details?.pincode || '000000';
  const mobileNumber = details?.mobile_number || '';
  const altMobile = details?.alternate_mobile || '';
  const contactLine = [mobileNumber, altMobile].filter(Boolean).join(' / ');

  const receiptHtml = `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>GST Receipt - Order ${order.id}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Fraunces:opsz,wght@9..144,600&display=swap');
        :root{
          --ink:#0f172a;
          --muted:#64748b;
          --accent1:#ff8a00;
          --accent2:#ff4d6d;
          --accent3:#2ec4b6;
          --accent4:#4d9de0;
          --paper:#ffffff;
          --bg1:#fff7ed;
          --bg2:#ecfeff;
        }
        * { box-sizing: border-box; }
        body {
          font-family: "Space Grotesk", "Segoe UI", sans-serif;
          padding: 28px;
          color: var(--ink);
          background: radial-gradient(1200px 400px at 10% -10%, var(--bg2), transparent 60%),
                      radial-gradient(1200px 500px at 90% -20%, var(--bg1), transparent 60%);
        }
        .header { display: flex; justify-content: space-between; align-items: start; gap: 16px; }
        .brand {
          font-family: "Fraunces", "Times New Roman", serif;
          font-size: 26px;
          font-weight: 600;
          letter-spacing: 0.3px;
        }
        .tag {
          font-size: 12px;
          padding: 6px 12px;
          border-radius: 999px;
          background: linear-gradient(90deg, #ffe29a, #ffbd86, #ffd6e7);
          color: #7a2d00;
          display: inline-block;
          font-weight: 600;
        }
        .meta {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 10px 12px;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
        }
        .card {
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 18px;
          margin-top: 16px;
          background: var(--paper);
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
          position: relative;
          overflow: hidden;
        }
        .card::before{
          content:"";
          position:absolute;
          inset:0;
          height:6px;
          background: linear-gradient(90deg, var(--accent1), var(--accent2), var(--accent3), var(--accent4));
        }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 8px; }
        .label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; }
        table { width: 100%; border-collapse: collapse; margin-top: 14px; }
        th, td { border-bottom: 1px dashed #e2e8f0; padding: 10px 8px; text-align: left; font-size: 13.5px; }
        th { background: #f8fafc; font-weight: 700; }
        tbody tr:nth-child(even) td { background: #f9fafb; }
        .totals {
          margin-top: 14px;
          width: 340px;
          margin-left: auto;
          background: #f8fafc;
          border-radius: 12px;
          padding: 10px 12px;
          border: 1px solid #e2e8f0;
        }
        .totals div { display: flex; justify-content: space-between; padding: 6px 0; }
        .total { font-weight: 700; font-size: 16px; color: #0f766e; }
        .note { font-size: 12px; color: var(--muted); margin-top: 12px; }
        .stamp {
          display: inline-block;
          padding: 6px 10px;
          border: 2px dashed #fb7185;
          color: #be123c;
          font-weight: 700;
          border-radius: 10px;
          transform: rotate(-2deg);
          background: #fff1f2;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="brand">${shopName}</div>
          <div class="tag">GST Receipt</div>
        </div>
        <div class="meta">
          <div><strong>GSTIN:</strong> ${gstNumber}</div>
          ${panNumber ? `<div><strong>PAN:</strong> ${panNumber}</div>` : ''}
          <div><strong>Invoice No:</strong> GST-${order.id}</div>
          <div><strong>Date:</strong> ${formatToIST(order.order_date)}</div>
        </div>
      </div>

      <div class="card grid">
        <div>
          <div class="label">Billed To</div>
          <div>${order.username || 'Customer'}</div>
          <div>${addressLine}</div>
          <div>${city}, ${state} - ${pincode}</div>
        </div>
        <div>
          <div class="label">Sold By</div>
          <div>${shopName}</div>
          ${ownerName ? `<div>Owner: ${ownerName}</div>` : ''}
          <div>${addressLine}</div>
          <div>${city}, ${state} - ${pincode}</div>
          ${contactLine ? `<div>Phone: ${contactLine}</div>` : ''}
          <div class="stamp">PAID</div>
        </div>
      </div>

      <div class="card">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows || '<tr><td colspan="5">No items</td></tr>'}
          </tbody>
        </table>

        <div class="totals">
          <div><span>Taxable Value</span><span>₹${subtotal.toFixed(2)}</span></div>
          <div><span>SGST (9%)</span><span>₹${sgst.toFixed(2)}</span></div>
          <div><span>CGST (9%)</span><span>₹${cgst.toFixed(2)}</span></div>
          <div class="total"><span>Grand Total</span><span>₹${grandTotal.toFixed(2)}</span></div>
        </div>

        <div class="note">This is a system-generated GST receipt.</div>
      </div>
    </body>
  </html>
  `;

  const blob = new Blob([receiptHtml], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `GST_Receipt_Order_${order.id}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showPopup('GST receipt downloaded', 'Success');
 };
 

 const handleEditClick = (order) => {
  // Assuming you have a Redux action to set order details
   dispatch(setOrderDetails(order));
   navigate('/neworder')
  //  console.log(order)
  //  setSelectedOrder(order);
  //  setShowEditModal(true);
 };

 const handleCloseModal = () => {
   setShowEditModal(false);
   setSelectedOrder(null);
   setOrderUpdateFlag(true);
 };
 useEffect(() => {
   handleSearch(search);
 }, [orders]);
 const fetchOrders = async () => {
   try {
     const res = await api.get('/orders');
     console.log("Orders", res.data.orders);
     setOrders(res.data.orders);
     setFilteredOrders(res.data.orders);
     setOfflineOrders(getOfflineOrderQueue());
   } catch (err) {
    setOfflineOrders(getOfflineOrderQueue());
    if(err.response?.data?.message === 'Invalid Token' || err.response?.status === '400' || err.response?.status == '401' || err.response?.status === '403'){
      showPopup("Token Expired Please Login Again!", "Session");
      navigate('/logout');
    }
    else{
     console.error("error While getting orders", err);
   }
  }
 };
 const handleSearch = (value) => {
   setSearch(value);
   const filtered = orders.filter(order =>
     order.id
   );
   setFilteredOrders(filtered);
 };
 const handleSort = (key) => {
   setSortBy(key);
   const sorted = [...filteredOrders].sort((a, b) => {
     if (key === 'date') return new Date(b.order_date) - new Date(a.order_date);
    //  console.log(a[key], b[key]);
     return a[key]-b[key];
   });
   setFilteredOrders(sorted);
 };
 const GST_COMPANY = {
  name: 'SHAJ Retail Products',
  addressLine1: 'Beside Masjid, Main Road',
  addressLine2: 'Mattampally, Suryapet - 508204',
  phone: '7981907327',
  gstin: '36GEBPA1674F1ZT',
 };
 const GST_RATE = 0.18; // 18% total GST (CGST 9% + SGST 9%) - update if needed

 const formatMoney = (value) => {
  const num = Number(value || 0);
  return num.toFixed(2);
 };

 const handleGstDownload = async (order) => {
  const details = shopDetails || await fetchShopDetails();
  const invoiceDate = order.order_date
    ? formatIstDate(order.order_date)
    : formatIstDate(new Date());

  const items = (order.items || []).map((item) => {
    const qty = Number(item.quantity || 0);
    const rate = Number(item.selling_price || 0);
    const amount = qty * rate;
    return {
      name: item.product_name || 'Item',
      qty,
      rate,
      amount,
      qtyLabel: formatItemQuantityPlain(item),
    };
  });

  const taxableValue = items.reduce((sum, item) => sum + item.amount, 0);
  const totalGst = taxableValue * GST_RATE;
  const halfGst = totalGst / 2;
  const grandTotal = taxableValue + totalGst;

  const shopName = details?.shop_name || GST_COMPANY.name;
  const addressLine1 = details?.address_line || GST_COMPANY.addressLine1;
  const addressLine2 = `${details?.city || ''}${details?.state ? `, ${details.state}` : ''}${details?.pincode ? ` - ${details.pincode}` : ''}`.trim() || GST_COMPANY.addressLine2;
  const phoneLine = [details?.mobile_number, details?.alternate_mobile].filter(Boolean).join(' / ') || GST_COMPANY.phone;
  const gstin = details?.gst_number || GST_COMPANY.gstin;
  const ownerName = details?.owner_name || '';
  const panNumber = details?.pan_number || '';

  const html = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>GST Invoice - Order ${order.id}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #111; margin: 24px; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; }
      .title { font-size: 22px; font-weight: 700; }
      .small { font-size: 12px; color: #444; }
      .section { margin-top: 16px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { border: 1px solid #ccc; padding: 8px; font-size: 12px; }
      th { background: #f2f2f2; text-align: left; }
      .right { text-align: right; }
      .totals { margin-top: 12px; width: 100%; }
      .totals td { border: none; padding: 4px 0; font-size: 12px; }
      .footer { margin-top: 20px; font-size: 12px; color: #333; }
    </style>
  </head>
  <body>
    <div class="header">
      <div>
        <div class="title">${shopName}</div>
        <div class="small">${addressLine1}</div>
        <div class="small">${addressLine2}</div>
        ${ownerName ? `<div class="small">Owner: ${ownerName}</div>` : ''}
        <div class="small">Phone: ${phoneLine}</div>
        <div class="small">GSTIN: ${gstin}</div>
        ${panNumber ? `<div class="small">PAN: ${panNumber}</div>` : ''}
      </div>
      <div>
        <div class="title">GST Invoice</div>
        <div class="small">Order ID: ${order.id}</div>
        <div class="small">Date: ${invoiceDate}</div>
      </div>
    </div>

    <div class="section">
      <table>
        <thead>
          <tr>
            <th style="width: 40px;">#</th>
            <th>Product</th>
            <th style="width: 80px;" class="right">Qty</th>
            <th style="width: 120px;" class="right">Rate</th>
            <th style="width: 140px;" class="right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td>${item.name}</td>
              <td class="right">${item.qtyLabel}</td>
              <td class="right">${formatMoney(item.rate)}</td>
              <td class="right">${formatMoney(item.amount)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <table class="totals">
      <tr>
        <td class="right">Taxable Value:</td>
        <td class="right" style="width: 140px;">${formatMoney(taxableValue)}</td>
      </tr>
      <tr>
        <td class="right">CGST (${(GST_RATE * 100 / 2).toFixed(1)}%):</td>
        <td class="right">${formatMoney(halfGst)}</td>
      </tr>
      <tr>
        <td class="right">SGST (${(GST_RATE * 100 / 2).toFixed(1)}%):</td>
        <td class="right">${formatMoney(halfGst)}</td>
      </tr>
      <tr>
        <td class="right"><strong>Grand Total:</strong></td>
        <td class="right"><strong>${formatMoney(grandTotal)}</strong></td>
      </tr>
    </table>

    <div class="footer">
      This is a system-generated GST invoice.
    </div>
  </body>
</html>
  `.trim();

  const blob = new Blob([html], { type: 'text/html' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `GST-Order-${order.id}.html`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
 };
 const handlePaymentClick = async (id, type) => {
  try{
  const res = await api.post('/orders/mark-paid', {
    order_id: id,
    type: type
  });
  showPopup("Marked as paid", "Success");
  setOrderUpdateFlag(1);
}
catch(err){
  if(err.response.data.message === 'Invalid Token'){
      showPopup("Token Expired Please Login Again!", "Session");
      navigate('/logout');
  }
  else
  showPopup("Error while processing payment Please Try Again!", "Error");
  console.log("Error while marking payment", err)
}

 }
 const handleOrderDelete =async(id) => {
  try {
    const res = await api.delete(`/orders/${id}`);
    const Id = id +"delete"
    const element = document.getElementById(Id);
    element.innerHTML = 'Deleted';
    element.classList.add('disabled')    
    showPopup("Deleted Successfully", "Success");
    setDeletedOrderIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setOrderUpdateFlag((prev) => !prev);
  } catch (error) {
    console.log("problem in Deleting the Order", error);
  }
 }
 const handleSubmitEdit = async (updatedOrder) => {
  try {
    const response = await api.put(`/orders/${selectedOrder.id}`, updatedOrder);

    if (response.status === 200) {
      showPopup('Order updated successfully!', 'Success');
      handleCloseModal();
    }
    setOrderUpdateFlag(true);
  }
  catch(err){
  if(err.response.data.message === 'Invalid Token'){
      showPopup("Token Expired Please Login Again!", "Session");
      navigate('/logout');
  }
  else
  showPopup("Error while processing payment Please Try Again!", "Error");
  console.log("Error while marking payment", err)
}
 };

 const handleSyncOffline = async () => {
  if (isSyncing) return;
  if (!navigator.onLine) {
    showPopup('You are offline. Connect to the internet and try again.', 'Offline');
    return;
  }
  setIsSyncing(true);
  try {
    const result = await processOfflineQueue(api);
    setOfflineOrders(getOfflineOrderQueue());
    if (result.processed === 0 && result.failed === 0) {
      showPopup('No offline orders to sync.', 'Sync');
    } else {
      showPopup(
        `Synced ${result.processed}. Failed ${result.failed}. Remaining ${result.remaining}.`,
        'Sync'
      );
      setOrderUpdateFlag((prev) => !prev);
    }
  } catch (err) {
    showPopup('Sync failed. Please try again.', 'Error');
 } finally {
    setIsSyncing(false);
  }
 };
useEffect(() => {
  fetchOrders().then(()=> setIsLoading(false))
  // setIsLoading(false);
}, [orderUpdateFlag]);
useEffect(() => {
  const refreshOffline = () => setOfflineOrders(getOfflineOrderQueue());
  refreshOffline();
  window.addEventListener('online', refreshOffline);
  return () => window.removeEventListener('online', refreshOffline);
}, []);

 const renderOfflineRows = () => (
  offlineOrders.map((entry, idx) => {
    const payload = entry.payload || {};
    const items = payload.items || payload.products || [];
    const totalPrice = payload.total_price || payload.total_amount || 0;
  return (
      <tr key={`offline-${entry.id || idx}`} className="table-warning">
        <td>Offline-{entry.id || idx}</td>
        <td className="fw-bold">
          {items.length > 0 ? items.map((p, i) => (
            <div key={i}>{p.product_name || p.name || 'Item'} - {formatItemDisplay(p)}</div>
          )) : <div className="text-muted">Pending Sync</div>}
        </td>
        <td>
          {items.length > 0 ? items.map((p, i) => (
            <div key={i}>{p.selling_price || p.price || '-'}</div>
          )) : <div>-</div>}
        </td>
        <td>{totalPrice}</td>
        <td>{payload.user_name || payload.username || 'Offline User'}</td>
        <td className="text-warning fw-bold">
          queued
          <div>
            <span className="badge bg-warning text-dark">Offline</span>
          </div>
        </td>
        <td>{formatToIST(entry.createdAt)}</td>
        {userRole === 'admin' && (
          <td>
            <button className="btn btn-secondary btn-sm" disabled>Edit</button>
          </td>
        )}
        <td>
          <button className="btn btn-outline-secondary btn-sm" disabled>
            Download
          </button>
        </td>
        <td>
          <button className="btn btn-outline-secondary btn-sm" disabled>Pay Now</button>
        </td>
        <td>
          <button className="btn btn-outline-secondary btn-sm" disabled>Delete</button>
        </td>
      </tr>
    );
  })
 );
 return (
  
    isLoading ?
    <div style={{height: '100vh'}}>
   <LoadingSpinner/>
   </div>
    :
    <>
<div className="container-fluid pt-5 orderspage-shell">
     {/* Navbar */}
{/* Header and Controls */}
<div className="text-center mb-4">
{/* <h5 className="bg-warning p-2 rounded">Company Name</h5> */}
<div className="row justify-content-around mt-4">
<div className="col-md-6  ">
<input
             type="text"
             placeholder="Search by OrderId"
             className="form-control"
             value={search}
             onChange={(e) => handleSearch(e.target.value)}
           />
</div>
<div className="col-md-4">
<select
             className="form-select"
             onChange={(e) => handleSort(e.target.value)}
             value={sortBy}
>
<option value="date">Sort by Date</option>
<option value="id">Sort by OrderId</option>
</select>
</div>
<div className="col-md-2">
  <button
    className="btn btn-outline-primary w-100"
    onClick={handleSyncOffline}
    disabled={isSyncing}
  >
    {isSyncing ? 'Syncing...' : 'Sync Offline'}
  </button>
</div>
</div>
</div>
{/* <TableComponent columns={columns} data = {orders && orders.orders}/> */}
     {/* Table */}
<div  className="table-responsive orderspage orders-table">
<table className="table table-hover  text-center align-middle small">
<thead className="">
<tr className='p-3'>
<th>OrderId</th>
<th>Products</th>
<th>Price</th>
<th>TotalPrice</th>
<th>ByUser</th>
<th>Status</th>
<th>Date</th>
{userRole === 'admin' && <th>Edit</th>}
<th>GST Receipt</th>
<th>Make Payment</th>
<th>Delete</th>
</tr>
</thead>
<tbody>
           {filteredOrders && filteredOrders.map((order, idx) => (
order.type === 'personal' ? null : <tr key={idx} className={deletedOrderIds.has(order.id) ? 'opacity-50' : ''}>
<td>{order.id}</td>
<td className='fw-bold orders-products-cell'>
                 {order.items.length>0 ? order.items.map(p => (
<div>{p.product_name} - {formatItemDisplay(p)}</div>
                 )) : <div className='text-success'>Purchased Items</div>}
</td>
<td>
                 {order.items && order.items.map(p => <div>{p.selling_price}</div>)}
</td>
<td>{order.total_price}</td>
<td>{order.username}</td>
<td class={order.order_status === 'completed'? 'text-success fw-bold': 'text-danger fw-bold'} >{order.order_status}</td>
<td>{formatToIST(order.order_date)}</td>
{userRole === 'admin' && (
<td>
<button className='btn btn-info' onClick={() => handleEditClick(order)} disabled={order.order_status === 'completed'}>Edit</button>

{showEditModal && order && (
  <EditOrderModal
    completeOrder={selectedOrder}
    onClose={handleCloseModal}
    onSubmit={handleSubmitEdit}
    setOrderUpdateFlag={setOrderUpdateFlag}
    navigate={navigate}
  />
)}
</td>
               )}
<td>
  <button className='btn btn-outline-primary btn-sm' onClick={() => downloadGstReceipt(order)}>
    Download
  </button>
</td>
<td >
    {order.order_status === 'pending' ? order.payment === 'cash'
    ? <button onClick={() => handlePaymentClick(order.id, order.type, order.payment)} className='btn btn-outline-success'>Mark as Paid</button> 
    : <button type="button" class="btn btn-outline-success" data-bs-toggle="modal" data-bs-target={`#exampleModal-${order.id}`}>
      Pay Now
      </button>
    : 'Done'}

    {/* <!-- Modal --> */}
<div  class="modal fade" id={`exampleModal-${order.id}`} tabindex="-1" aria-labelledby="exampleModalLabel" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content" style={{width: '100% !important'}}>
      <div class="modal-header">
        <h5 class="modal-title" id="exampleModalLabel">payment QR</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        <div style={{fontFamily: 'sans-serif', fontSize: 40}}> <span className='fw-bold'>Rs. {order.total_price}</span></div>
        <img src='https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQG2YbnRpjVi-n9hZYm-mifpv6YGaYaiEyfxg&s' />
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
        <button type="button" class="btn btn-primary" data-bs-dismiss="modal" onClick={()=> handlePaymentClick(order.id, order.type, order.payment)}>Payment Received</button>
      </div>
    </div>
  </div>
</div>
</td>
<td>
  <button id={order.id+"delete"} onClick={() => handleOrderDelete(order.id)} className='btn btn-sm btn-danger' disabled={order.order_status === 'completed'}>Delete</button>
</td>
</tr>
           ))}
{offlineOrders.length > 0 && renderOfflineRows()}
{filteredOrders.length === 0 && (
<tr>
<td colSpan={userRole === 'admin' ? 11 : 10}>No orders found.</td>
</tr>
           )}
</tbody>
</table>
</div>
{/* <!-- Button trigger modal --> */}



</div>
</>

 );
};
export default OrdersPage;
