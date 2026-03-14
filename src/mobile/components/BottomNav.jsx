import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/m/dashboard', label: 'Dashboard' },
  { to: '/m/orders', label: 'Orders' },
  { to: '/m/products', label: 'Products' },
  { to: '/m/reports', label: 'Reports' },
  { to: '/m/settings', label: 'Settings' }
];

const BottomNav = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-ink/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3 text-xs font-medium text-white/70">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 ${
                isActive ? 'text-ember' : 'text-white/70'
              }`
            }
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            <span className="text-[11px] tracking-wide">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
