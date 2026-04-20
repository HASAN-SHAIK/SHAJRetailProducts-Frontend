import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/m/dashboard', label: 'Home', icon: 'M3 12l9-7 9 7' },
  { to: '/m/neworder', label: 'Billing', icon: 'M4 6h16M4 12h16M4 18h10' },
  { to: '/m/orders', label: 'Orders', icon: 'M6 7h12M6 12h12M6 17h7' },
  { to: '/m/products', label: 'Stock', icon: 'M4 7l8-4 8 4-8 4-8-4Zm0 0v10l8 4 8-4V7' },
  { to: '/m/reports', label: 'Reports', icon: 'M5 19V9M12 19V5M19 19v-7' },
  { to: '/m/settings', label: 'Settings', icon: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z' }
];

const BottomNav = () => {
  return (
    <nav className="mobile-nav">
      <div className="mobile-nav-inner">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `mobile-nav-link${isActive ? ' active' : ''}`}
          >
            <svg
              viewBox="0 0 24 24"
              style={{ width: 14, height: 14 }}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={item.icon} />
              {item.label === 'Settings' && (
                <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.7l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.7-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.7.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.7 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.7.3 1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.7-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.7 1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
              )}
            </svg>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
