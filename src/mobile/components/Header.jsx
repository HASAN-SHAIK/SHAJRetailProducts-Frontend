import { useSelector } from 'react-redux';
import { useMobileTheme } from '../theme/MobileThemeContext';

const Header = () => {
  const tenantConfig = useSelector((state) => state.tenant.tenantConfig);
  const userDetails = useSelector((state) => state.user.userDetails);
  const shopName = tenantConfig?.shop_name || tenantConfig?.shopName || 'SHAJRetail';
  const userName = userDetails?.user_name || userDetails?.name || 'Owner';
  const { theme, toggleTheme } = useMobileTheme();

  return (
    <header className="mobile-header">
      <div className="mobile-container mobile-header-inner">
        <div>
          <h1 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{shopName}</h1>
          <p className="mobile-muted" style={{ margin: '2px 0 0', fontSize: 11 }}>{userName}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="mobile-chip">{theme === 'dark' ? 'Dark' : 'Light'} Mode</span>
          <button
            type="button"
            aria-label="Toggle theme"
            className="mobile-icon-btn"
            onClick={toggleTheme}
            title="Toggle light/dark"
          >
            {theme === 'dark' ? '?' : '?'}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
