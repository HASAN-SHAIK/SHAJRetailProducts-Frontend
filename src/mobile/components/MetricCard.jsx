const MetricCard = ({ label, value, helper }) => {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-2 text-center shadow-soft-lg transition hover:bg-white/10">
      <p className="text-[8px] uppercase tracking-[0.22em] text-white/50">{label}</p>
      <p className="mt-0.5 text-[12px] font-semibold text-white">{value}</p>
      {helper ? <p className="mt-0.5 text-[8px] text-white/60">{helper}</p> : null}
    </div>
  );
};

export default MetricCard;
