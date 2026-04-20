import dayjs from 'dayjs';

const formatCurrency = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const statusTone = (status) => {
  const s = String(status || '').toLowerCase();
  if (['delivered', 'completed', 'paid'].some((token) => s.includes(token))) return 'success';
  if (['pending', 'processing'].some((token) => s.includes(token))) return 'warn';
  return 'danger';
};

const OrderItem = ({ order, showStatus = true }) => {
  const itemsCount = order?.items_count ?? order?.items ?? order?.order_items?.length ?? 0;
  const customer = order?.customer_name || order?.customer?.name || 'Walk-in Customer';
  const total = order?.total ?? order?.grand_total ?? order?.amount ?? 0;

  return (
    <article className="mobile-item">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Order #{order?.id || 'NA'}</p>
          <p className="mobile-muted" style={{ margin: '3px 0 0', fontSize: 10 }}>
            {dayjs(order?.created_at || order?.createdAt || new Date()).format('DD MMM, hh:mm A')}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Rs {formatCurrency(total)}</p>
          <p className="mobile-muted" style={{ margin: '3px 0 0', fontSize: 10 }}>{itemsCount} items</p>
        </div>
      </div>

      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <p className="mobile-muted" style={{ margin: 0, fontSize: 11 }}>{customer}</p>
        {showStatus ? <span className={`mobile-badge ${statusTone(order?.status)}`}>{order?.status || 'Pending'}</span> : null}
      </div>
    </article>
  );
};

export default OrderItem;
