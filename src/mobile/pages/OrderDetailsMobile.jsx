import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { getCachedOrderById, getCachedOrderDetails } from '../../db/ordersDb';
import MobileShell from '../components/MobileShell';
import SectionCard from '../components/SectionCard';

const formatCurrency = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const OrderDetailsMobile = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchOrder = async () => {
      try {
        const cachedDetails = await getCachedOrderDetails(id);
        if (cachedDetails) {
          if (active) setOrder(cachedDetails);
          return;
        }
        const cachedOrder = await getCachedOrderById(id);
        if (active) setOrder(cachedOrder || null);
      } catch {
        if (active) setOrder(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchOrder();
    return () => {
      active = false;
    };
  }, [id]);

  const totals = useMemo(() => {
    const subtotal = Number(order?.subtotal ?? order?.total ?? 0);
    const tax = Number(order?.tax_amount ?? order?.tax ?? 0);
    const discount = Number(order?.discount_amount ?? order?.discount ?? 0);
    const grandTotal = Number(order?.total ?? subtotal + tax - discount);
    return { subtotal, tax, discount, grandTotal };
  }, [order]);

  return (
    <MobileShell title={`Order #${id}`} subtitle="Order summary, customer details, and line items in one place.">
      <SectionCard title="Order Summary">
        {loading && <p className="mobile-muted" style={{ margin: 0, fontSize: 12 }}>Loading order details...</p>}
        {!loading && !order && <p className="mobile-muted" style={{ margin: 0, fontSize: 12 }}>Order not found in IndexedDB.</p>}

        {!loading && order && (
          <>
            <div className="mobile-inline-grid">
              <div className="mobile-item">
                <p className="mobile-card-title" style={{ margin: 0 }}>Status</p>
                <p style={{ margin: '6px 0 0', fontWeight: 700 }}>{order?.status || 'Pending'}</p>
              </div>
              <div className="mobile-item">
                <p className="mobile-card-title" style={{ margin: 0 }}>Payment</p>
                <p style={{ margin: '6px 0 0', fontWeight: 700 }}>{order?.payment_mode || order?.paymentMode || 'NA'}</p>
              </div>
            </div>

            <div className="mobile-item">
              <p className="mobile-card-title" style={{ margin: 0 }}>Customer</p>
              <p style={{ margin: '6px 0 0', fontWeight: 700 }}>{order?.customer_name || order?.customer?.name || 'Walk-in Customer'}</p>
              <p className="mobile-muted" style={{ margin: '4px 0 0', fontSize: 11 }}>
                {order?.customer_phone || order?.customer?.phone || 'No phone'}
                {' • '}
                {dayjs(order?.created_at || order?.createdAt || new Date()).format('DD MMM YYYY, hh:mm A')}
              </p>
            </div>

            <div className="mobile-item" style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span className="mobile-muted">Subtotal</span>
                <strong>Rs {formatCurrency(totals.subtotal)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span className="mobile-muted">Tax</span>
                <strong>Rs {formatCurrency(totals.tax)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span className="mobile-muted">Discount</span>
                <strong>Rs {formatCurrency(totals.discount)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 2 }}>
                <span style={{ fontWeight: 700 }}>Grand Total</span>
                <strong>Rs {formatCurrency(totals.grandTotal)}</strong>
              </div>
            </div>
          </>
        )}
      </SectionCard>

      <SectionCard title="Order Items" action={<span className="mobile-chip">{order?.items?.length || 0} lines</span>}>
        {!loading && (order?.items || []).length === 0 && (
          <p className="mobile-muted" style={{ margin: 0, fontSize: 12 }}>No items found for this order.</p>
        )}

        {!loading &&
          (order?.items || []).map((item, index) => {
            const qty = Number(item?.quantity || 0);
            const price = Number(item?.price || 0);
            return (
              <article key={`${item?.product_name || 'item'}-${index}`} className="mobile-item">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{item?.product_name || 'Unnamed Product'}</p>
                    <p className="mobile-muted" style={{ margin: '4px 0 0', fontSize: 10 }}>
                      SKU: {item?.sku || item?.product_id || 'NA'}
                    </p>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700 }}>Rs {formatCurrency(qty * price)}</p>
                </div>
                <p className="mobile-muted" style={{ margin: '6px 0 0', fontSize: 11 }}>
                  Qty {qty} x Rs {formatCurrency(price)}
                </p>
              </article>
            );
          })}
      </SectionCard>
    </MobileShell>
  );
};

export default OrderDetailsMobile;
