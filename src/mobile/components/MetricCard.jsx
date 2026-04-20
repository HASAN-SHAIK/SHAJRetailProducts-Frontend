const MetricCard = ({ label, value, helper }) => {
  return (
    <div className="mobile-card" style={{ padding: 10 }}>
      <p className="mobile-card-title" style={{ margin: 0 }}>{label}</p>
      <p className="mobile-metric-value">{value}</p>
      {helper ? <p className="mobile-muted" style={{ margin: '3px 0 0', fontSize: 10 }}>{helper}</p> : null}
    </div>
  );
};

export default MetricCard;
