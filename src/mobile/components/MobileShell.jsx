import BottomNav from './BottomNav';
import Header from './Header';
import '../styles/mobile.css';
import { MobileThemeProvider, useMobileTheme } from '../theme/MobileThemeContext';

const ShellLayout = ({ title, subtitle, children }) => {
  const { theme } = useMobileTheme();

  return (
    <div className={`mobile-app mobile-theme-${theme}`}>
      <Header />
      <div className="mobile-container">
        <p className="mobile-overline">Mobile Console</p>
        <h2 className="mobile-title">{title}</h2>
        {subtitle ? <p className="mobile-subtitle">{subtitle}</p> : null}
        <main className="mobile-main">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
};

const MobileShell = ({ title = 'Overview', subtitle, children }) => {
  return (
    <MobileThemeProvider>
      <ShellLayout title={title} subtitle={subtitle}>
        {children}
      </ShellLayout>
    </MobileThemeProvider>
  );
};

export default MobileShell;
