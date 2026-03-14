const MetricCard = ({ label, value, helper }) => {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-soft-lg">
      <p className="text-xs uppercase tracking-[0.2em] text-white/50">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
      {helper ? <p className="mt-2 text-xs text-white/60">{helper}</p> : null}
    </div>
  );
};

export default MetricCard;
