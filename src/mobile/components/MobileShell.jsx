import BottomNav from './BottomNav';
import Header from './Header';
import '../styles/mobile.css';
import { MobileThemeProvider, useMobileTheme } from '../theme/MobileThemeContext';

const ShellLayout = ({ children }) => {
  const { theme } = useMobileTheme();

  return (
    <div className={`mobile-app mobile-theme-${theme}`}>
      <Header />
      <div className="mobile-container">
        <main className="mobile-main">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
};

const MobileShell = ({ children }) => {
  return (
    <MobileThemeProvider>
      <ShellLayout>
        {children}
      </ShellLayout>
    </MobileThemeProvider>
  );
};

export default MobileShell;
