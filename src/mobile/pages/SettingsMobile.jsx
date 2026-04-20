import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import MobileShell from '../components/MobileShell';
import SectionCard from '../components/SectionCard';
import { useMobileTheme } from '../theme/MobileThemeContext';

const DRAFT_KEY = 'mobile_settings_draft_v1';

const SettingsBody = () => {
  const userDetails = useSelector((state) => state.user.userDetails);
  const tenantConfig = useSelector((state) => state.tenant.tenantConfig);
  const { theme, setTheme, toggleTheme } = useMobileTheme();

  const initialState = useMemo(
    () => ({
      shopName: tenantConfig?.shop_name || tenantConfig?.shopName || '',
      ownerName: userDetails?.user_name || userDetails?.name || '',
      phone: tenantConfig?.phone || userDetails?.phone || '',
      email: userDetails?.email || '',
      address: tenantConfig?.address || '',
      gstin: tenantConfig?.gstin || '',
      invoicePrefix: tenantConfig?.invoice_prefix || 'INV',
      invoiceFooter: tenantConfig?.invoice_footer || 'Thank you for shopping with us.',
      defaultTax: tenantConfig?.default_tax || '18',
      currency: 'INR',
      autoSync: true,
      notifications: true,
      biometricLock: false,
    }),
    [tenantConfig, userDetails]
  );

  const [form, setForm] = useState(initialState);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const saved = window.localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setForm((prev) => ({ ...prev, ...parsed }));
      } catch {
        // ignore malformed drafts
      }
    }
  }, []);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    setMessage('Preferences saved on this device.');
    setTimeout(() => setMessage(''), 2200);
  };

  return (
    <>
      <SectionCard title="Appearance">
        <div className="mobile-item">
          <label className="mobile-label">Theme Mode</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="mobile-button secondary" onClick={() => setTheme('light')}>Light</button>
            <button type="button" className="mobile-button secondary" onClick={() => setTheme('dark')}>Dark</button>
          </div>
          <p className="mobile-muted" style={{ margin: '8px 0 0', fontSize: 11 }}>Current mode: {theme}</p>
          <button type="button" className="mobile-button" style={{ marginTop: 8 }} onClick={toggleTheme}>Toggle Theme</button>
        </div>
      </SectionCard>

      <SectionCard title="Shop Profile">
        <div>
          <label className="mobile-label">Shop Name</label>
          <input className="mobile-field" value={form.shopName} onChange={(e) => updateField('shopName', e.target.value)} />
        </div>
        <div>
          <label className="mobile-label">Owner Name</label>
          <input className="mobile-field" value={form.ownerName} onChange={(e) => updateField('ownerName', e.target.value)} />
        </div>
        <div className="mobile-inline-grid">
          <div>
            <label className="mobile-label">Phone</label>
            <input className="mobile-field" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} />
          </div>
          <div>
            <label className="mobile-label">Email</label>
            <input className="mobile-field" value={form.email} onChange={(e) => updateField('email', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="mobile-label">Address</label>
          <input className="mobile-field" value={form.address} onChange={(e) => updateField('address', e.target.value)} />
        </div>
        <div>
          <label className="mobile-label">GSTIN</label>
          <input className="mobile-field" value={form.gstin} onChange={(e) => updateField('gstin', e.target.value)} />
        </div>
      </SectionCard>

      <SectionCard title="Billing Defaults">
        <div className="mobile-inline-grid">
          <div>
            <label className="mobile-label">Invoice Prefix</label>
            <input className="mobile-field" value={form.invoicePrefix} onChange={(e) => updateField('invoicePrefix', e.target.value)} />
          </div>
          <div>
            <label className="mobile-label">Default Tax %</label>
            <input className="mobile-field" value={form.defaultTax} onChange={(e) => updateField('defaultTax', e.target.value)} />
          </div>
        </div>
        <div>
          <label className="mobile-label">Invoice Footer</label>
          <input className="mobile-field" value={form.invoiceFooter} onChange={(e) => updateField('invoiceFooter', e.target.value)} />
        </div>
        <div>
          <label className="mobile-label">Currency</label>
          <select className="mobile-field" value={form.currency} onChange={(e) => updateField('currency', e.target.value)}>
            <option value="INR">INR (Rs)</option>
            <option value="USD">USD ($)</option>
          </select>
        </div>
      </SectionCard>

      <SectionCard title="Operational Preferences">
        <label className="mobile-switch">
          <input type="checkbox" checked={form.autoSync} onChange={(e) => updateField('autoSync', e.target.checked)} />
          <span style={{ fontSize: 12 }}>Auto-sync background data</span>
        </label>
        <label className="mobile-switch">
          <input type="checkbox" checked={form.notifications} onChange={(e) => updateField('notifications', e.target.checked)} />
          <span style={{ fontSize: 12 }}>Enable notifications</span>
        </label>
        <label className="mobile-switch">
          <input type="checkbox" checked={form.biometricLock} onChange={(e) => updateField('biometricLock', e.target.checked)} />
          <span style={{ fontSize: 12 }}>Biometric lock</span>
        </label>
      </SectionCard>

      <SectionCard title="Actions">
        <button type="button" className="mobile-button" onClick={handleSave}>Save Preferences</button>
        {message ? <p className="mobile-muted" style={{ margin: '4px 0 0', fontSize: 11 }}>{message}</p> : null}
        <Link to="/logout" className="mobile-button secondary" style={{ textDecoration: 'none', textAlign: 'center' }}>Logout</Link>
      </SectionCard>
    </>
  );
};

const SettingsMobile = () => {
  return (
    <MobileShell title="Settings" subtitle="Manage shop profile, invoice defaults, and app preferences.">
      <SettingsBody />
    </MobileShell>
  );
};

export default SettingsMobile;
