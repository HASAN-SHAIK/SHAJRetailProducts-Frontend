import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import MobileShell from '../components/MobileShell';
import SectionCard from '../components/SectionCard';

const DRAFT_KEY = 'mobile_billing_draft_v1';

const createEmptyItem = () => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: '',
  qty: 1,
  price: 0,
  discount: 0,
});

const formatCurrency = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const BillingMobile = () => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [billingType, setBillingType] = useState('retail');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [taxPercent, setTaxPercent] = useState(18);
  const [extraDiscount, setExtraDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([createEmptyItem()]);
  const [message, setMessage] = useState('');

  const updateItem = (id, field, value) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const addItem = () => setItems((prev) => [...prev, createEmptyItem()]);
  const removeItem = (id) => setItems((prev) => prev.filter((item) => item.id !== id));

  const totals = useMemo(() => {
    const subtotal = items.reduce((acc, item) => {
      const qty = Number(item.qty || 0);
      const price = Number(item.price || 0);
      const discount = Number(item.discount || 0);
      const gross = qty * price;
      return acc + Math.max(gross - discount, 0);
    }, 0);

    const lineDiscount = items.reduce((acc, item) => acc + Number(item.discount || 0), 0);
    const orderDiscount = Number(extraDiscount || 0);
    const taxable = Math.max(subtotal - orderDiscount, 0);
    const taxAmount = (taxable * Number(taxPercent || 0)) / 100;
    const grandTotal = taxable + taxAmount;

    return { subtotal, lineDiscount, orderDiscount, taxable, taxAmount, grandTotal };
  }, [extraDiscount, items, taxPercent]);

  const saveDraft = () => {
    const payload = {
      customerName,
      customerPhone,
      billingType,
      paymentMode,
      taxPercent,
      extraDiscount,
      notes,
      items,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    setMessage('Billing draft saved on this device.');
    setTimeout(() => setMessage(''), 2200);
  };

  return (
    <MobileShell title="Billing" subtitle="Create quick invoices with complete bill details from mobile.">
      <SectionCard title="Customer & Invoice">
        <div>
          <label className="mobile-label">Customer Name</label>
          <input className="mobile-field" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Walk-in customer" />
        </div>
        <div className="mobile-inline-grid">
          <div>
            <label className="mobile-label">Phone Number</label>
            <input className="mobile-field" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="10-digit number" />
          </div>
          <div>
            <label className="mobile-label">Invoice Date</label>
            <input type="date" className="mobile-field" value={dayjs().format('YYYY-MM-DD')} readOnly />
          </div>
        </div>
        <div className="mobile-inline-grid">
          <div>
            <label className="mobile-label">Billing Type</label>
            <select className="mobile-field" value={billingType} onChange={(e) => setBillingType(e.target.value)}>
              <option value="retail">Retail Billing</option>
              <option value="wholesale">Wholesale Billing</option>
              <option value="gst">GST Invoice</option>
            </select>
          </div>
          <div>
            <label className="mobile-label">Payment Mode</label>
            <select className="mobile-field" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
              <option value="credit">Credit</option>
            </select>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Line Items" action={<button type="button" className="mobile-chip" onClick={addItem}>+ Add item</button>}>
        {items.map((item, index) => (
          <article key={item.id} className="mobile-item" style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p className="mobile-card-title" style={{ margin: 0 }}>Item {index + 1}</p>
              {items.length > 1 ? (
                <button type="button" className="mobile-chip" onClick={() => removeItem(item.id)}>Remove</button>
              ) : null}
            </div>
            <input className="mobile-field" value={item.name} onChange={(e) => updateItem(item.id, 'name', e.target.value)} placeholder="Product name / barcode" />
            <div className="mobile-inline-grid">
              <div>
                <label className="mobile-label">Quantity</label>
                <input type="number" min="1" className="mobile-field" value={item.qty} onChange={(e) => updateItem(item.id, 'qty', e.target.value)} />
              </div>
              <div>
                <label className="mobile-label">Unit Price</label>
                <input type="number" min="0" className="mobile-field" value={item.price} onChange={(e) => updateItem(item.id, 'price', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="mobile-label">Item Discount</label>
              <input type="number" min="0" className="mobile-field" value={item.discount} onChange={(e) => updateItem(item.id, 'discount', e.target.value)} />
            </div>
          </article>
        ))}
      </SectionCard>

      <SectionCard title="Tax, Discount & Notes">
        <div className="mobile-inline-grid">
          <div>
            <label className="mobile-label">Order Discount</label>
            <input type="number" min="0" className="mobile-field" value={extraDiscount} onChange={(e) => setExtraDiscount(e.target.value)} />
          </div>
          <div>
            <label className="mobile-label">Tax %</label>
            <input type="number" min="0" className="mobile-field" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="mobile-label">Notes</label>
          <input className="mobile-field" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add delivery note, due date, etc." />
        </div>
      </SectionCard>

      <SectionCard title="Bill Summary">
        <div className="mobile-item" style={{ display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span className="mobile-muted">Subtotal</span><strong>Rs {formatCurrency(totals.subtotal)}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span className="mobile-muted">Line discount</span><strong>Rs {formatCurrency(totals.lineDiscount)}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span className="mobile-muted">Order discount</span><strong>Rs {formatCurrency(totals.orderDiscount)}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span className="mobile-muted">Taxable amount</span><strong>Rs {formatCurrency(totals.taxable)}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span className="mobile-muted">Tax amount</span><strong>Rs {formatCurrency(totals.taxAmount)}</strong></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}><span style={{ fontWeight: 700 }}>Grand total</span><strong>Rs {formatCurrency(totals.grandTotal)}</strong></div>
        </div>
      </SectionCard>

      <SectionCard title="Actions">
        <button type="button" className="mobile-button" onClick={saveDraft}>Save Draft Bill</button>
        <Link to="/neworder" className="mobile-button secondary" style={{ textDecoration: 'none', textAlign: 'center' }}>Open Full Billing Screen</Link>
        {message ? <p className="mobile-muted" style={{ margin: '2px 0 0', fontSize: 11 }}>{message}</p> : null}
      </SectionCard>
    </MobileShell>
  );
};

export default BillingMobile;
