import { useSelector } from 'react-redux';
import { useBranchStore } from '../../store/branchStore';

const Header = () => {
  const tenantConfig = useSelector((state) => state.tenant.tenantConfig);
  const userDetails = useSelector((state) => state.user.userDetails);
  const userRole = useSelector((state) => state.tenant.role);
  const branches = useBranchStore((state) => state.branches);
  const selectedBranchId = useBranchStore((state) => state.selectedBranchId);
  const selectedBranchName = useBranchStore((state) => state.selectedBranchName);
  const setSelectedBranchId = useBranchStore((state) => state.setSelectedBranchId);
  const shopName = tenantConfig?.shop_name || tenantConfig?.shopName || 'SHAJRetail';
  const userName = userDetails?.user_name || userDetails?.name || 'Owner';

  const getBranchLabel = (branch, fallback = '') =>
    String(
      branch?.name ??
      branch?.branch_name ??
      branch?.title ??
      fallback
    ).trim();

  const handleBranchChange = (event) => {
    const value = String(event.target.value || '');
    if (!value) {
      setSelectedBranchId(null, { confirmed: false, name: '' });
      return;
    }
    if (value === 'all') {
      setSelectedBranchId('all', { confirmed: true, name: 'All' });
      return;
    }
    const matched = branches.find((branch) => String(branch?.id) === value);
    const label = getBranchLabel(matched, selectedBranchName || 'Selected Branch');
    setSelectedBranchId(value, { confirmed: true, name: label });
  };

  return (
    <header className="mobile-header">
      <div className="mobile-container mobile-header-inner">
        <div>
          <h1 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{shopName}</h1>
          <p className="mobile-muted" style={{ margin: '2px 0 0', fontSize: 11 }}>{userName}</p>
        </div>
        <div className="mobile-header-right">
          <label htmlFor="mobile-branch-select" className="mobile-branch-label">Branch</label>
          <select
            id="mobile-branch-select"
            className="mobile-branch-select"
            value={selectedBranchId || ''}
            onChange={handleBranchChange}
          >
            <option value="">Select</option>
            {userRole === 'admin' && <option value="all">All</option>}
            {selectedBranchId &&
              selectedBranchId !== 'all' &&
              !branches.some((branch) => String(branch?.id) === String(selectedBranchId)) && (
                <option value={String(selectedBranchId)}>
                  {selectedBranchName || 'Selected Branch'}
                </option>
            )}
            {branches.map((branch, index) => (
              <option key={branch?.id || `branch-${index}`} value={String(branch?.id || '')}>
                {getBranchLabel(branch, `Branch ${index + 1}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
};

export default Header;
