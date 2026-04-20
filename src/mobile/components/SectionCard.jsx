const SectionCard = ({ title, action, children }) => {
  return (
    <section className="mobile-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 className="mobile-card-title">{title}</h3>
        {action ? <div>{action}</div> : null}
      </div>
      <div className="mobile-list">{children}</div>
    </section>
  );
};

export default SectionCard;
