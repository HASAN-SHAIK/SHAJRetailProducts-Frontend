import BottomNav from './BottomNav';

const MobileShell = ({ title, subtitle, children }) => {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(31,122,91,0.35),_rgba(18,19,23,0.9)_55%,_rgba(10,10,12,1)_100%)] pb-24 text-white">
      <header className="mx-auto max-w-md px-5 pt-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">SHAJRetail</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">{title}</h1>
            {subtitle ? <p className="mt-2 text-sm text-white/70">{subtitle}</p> : null}
          </div>
          <div className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/80">
            Mobile
          </div>
        </div>
      </header>
      <main className="mx-auto mt-6 flex w-full max-w-md flex-col gap-6 px-5">
        {children}
      </main>
      <BottomNav />
    </div>
  );
};

export default MobileShell;
