const SectionCard = ({ title, children }) => {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-soft-xl">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-white/60">
          {title}
        </h2>
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
};

export default SectionCard;
