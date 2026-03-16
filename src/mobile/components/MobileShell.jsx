import BottomNav from './BottomNav';
import Header from './Header';

const MobileShell = ({ title, subtitle, children }) => {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,86,130,0.35),_rgba(10,18,35,0.95)_55%,_rgba(6,10,20,1)_100%)] pb-24 text-white">
      <Header />
      <div className="mx-auto w-full max-w-md px-3">
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">Overview</p>
          <h2 className="mt-1.5 text-[18px] font-semibold text-white">{title}</h2>
          {subtitle ? <p className="mt-1.5 text-[11px] text-white/70">{subtitle}</p> : null}
        </div>
      </div>
      <main className="mx-auto mt-3 flex w-full max-w-md flex-col gap-4 px-3">
        {children}
      </main>
      <BottomNav />
    </div>
  );
};

export default MobileShell;
