import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import MobileShell from '../components/MobileShell';
import SectionCard from '../components/SectionCard';

const SettingsMobile = () => {
  const userDetails = useSelector((state) => state.user.userDetails);
  const tenantConfig = useSelector((state) => state.tenant.tenantConfig);

  return (
    <MobileShell title="Settings" subtitle="Account details and quick actions.">
      <SectionCard title="Shop Info">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Shop Name</p>
          <p className="mt-2 text-base font-semibold text-white">
            {tenantConfig?.shop_name || tenantConfig?.shopName || 'SHAJRetail Shop'}
          </p>
        </div>
      </SectionCard>

      <SectionCard title="User Profile">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">User</p>
          <p className="mt-2 text-base font-semibold text-white">
            {userDetails?.user_name || userDetails?.name || 'Shop Owner'}
          </p>
          <p className="mt-2 text-xs text-white/60">{userDetails?.email || 'No email set'}</p>
        </div>
      </SectionCard>

      <SectionCard title="Quick Actions">
        <Link
          to="/logout"
          className="block w-full rounded-2xl border border-ember/60 bg-ember/20 px-4 py-3 text-center text-sm font-semibold text-ember"
        >
          Logout
        </Link>
      </SectionCard>
    </MobileShell>
  );
};

export default SettingsMobile;
