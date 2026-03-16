import dayjs from 'dayjs';

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const OrderItem = ({ order, showStatus = true }) => {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-2.5 py-1.5">
      <div>
        <p className="text-[11px] font-semibold text-white">Order #{order.id}</p>
        <p className="text-[9px] text-white/60">
          {dayjs(order.created_at).format('DD MMM, h:mm A')}
        </p>
        {showStatus ? (
          <p className="mt-0.5 text-[9px] uppercase tracking-[0.2em] text-[#7EB6FF]">
            {order.status}
          </p>
        ) : null}
      </div>
      <div className="text-right">
        <p className="text-[11px] font-semibold text-white">₹{formatCurrency(order.total)}</p>
        <p className="text-[9px] text-white/60">{order.items} items</p>
      </div>
    </div>
  );
};

export default OrderItem;
