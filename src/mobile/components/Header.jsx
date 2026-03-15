import { useSelector } from 'react-redux';

const Header = () => {
  const tenantConfig = useSelector((state) => state.tenant.tenantConfig);
  const shopName =
    tenantConfig?.shop_name || tenantConfig?.shopName || 'SHAJRetail';

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0B152A]/90 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between px-3 py-2.5">
        <div className="min-w-0">
          <h1 className="truncate text-[14px] font-semibold text-white">{shopName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Notifications"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                d="M12 3a5 5 0 0 0-5 5v3.5l-1.4 2.1A1 1 0 0 0 6.4 15h11.2a1 1 0 0 0 .8-1.4L17 11.5V8a5 5 0 0 0-5-5Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M9.5 18a2.5 2.5 0 0 0 5 0" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Profile"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="12" cy="8" r="3.2" />
              <path
                d="M4.5 19.2c1.9-3 4.5-4.5 7.5-4.5s5.6 1.5 7.5 4.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
