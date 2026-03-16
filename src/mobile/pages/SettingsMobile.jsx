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
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-[12px] text-white/80">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Shop Name</p>
          <p className="mt-2 text-[14px] font-semibold text-white">
            {tenantConfig?.shop_name || tenantConfig?.shopName || 'SHAJRetail Shop'}
          </p>
        </div>
      </SectionCard>

      <SectionCard title="User Profile">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-[12px] text-white/80">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">User</p>
          <p className="mt-2 text-[14px] font-semibold text-white">
            {userDetails?.user_name || userDetails?.name || 'Shop Owner'}
          </p>
          <p className="mt-2 text-[11px] text-white/60">{userDetails?.email || 'No email set'}</p>
        </div>
      </SectionCard>

      <SectionCard title="Subscription Plan">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-[12px] text-white/80">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Plan</p>
          <p className="mt-2 text-[14px] font-semibold text-white">
            {tenantConfig?.plan_type || tenantConfig?.planType || 'Standard'}
          </p>
          <p className="mt-2 text-[11px] text-white/60">
            {tenantConfig?.subscription_status || tenantConfig?.subscriptionStatus || 'Active'}
          </p>
        </div>
      </SectionCard>

      <SectionCard title="Quick Actions">
        <Link
          to="/logout"
          className="block w-full rounded-2xl border border-[#FF7A59]/60 bg-[#FF7A59]/15 px-4 py-2.5 text-center text-[12px] font-semibold text-[#FF7A59]"
        >
          Logout
        </Link>
      </SectionCard>
    </MobileShell>
  );
};

export default SettingsMobile;
