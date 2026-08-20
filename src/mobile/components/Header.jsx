import { useSelector } from 'react-redux';
import { useBranchStore } from '../../store/branchStore';
import { findBranchById, getBranchDisplayName, getBranchId } from '../../utils/branchLabels';
import { isLocalPosEnabled } from '../../Repositories/local/posLocalApiClient';

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
  const localPosMode = isLocalPosEnabled();
  const cleanSelectedBranchName = String(selectedBranchName || '').trim();
  const currentBranchLabel =
    (cleanSelectedBranchName && cleanSelectedBranchName.toLowerCase() !== 'all' ? cleanSelectedBranchName : '') ||
    (selectedBranchId && selectedBranchId !== 'all' ? `POS ${selectedBranchId}` : 'POS Linked');
  const canSelectAllBranches =
    String(userRole || '').toLowerCase() === 'admin' || userDetails?.all_branch_access !== false;

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
    const matched = findBranchById(branches, value);
    const label = getBranchDisplayName(matched, selectedBranchName || 'Selected Branch');
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
          {localPosMode ? (
            <div
              id="mobile-branch-select"
              className="mobile-branch-select mobile-branch-readonly"
              aria-readonly="true"
            >
              {currentBranchLabel}
            </div>
          ) : (
          <select
            id="mobile-branch-select"
            className="mobile-branch-select"
            value={selectedBranchId || ''}
            onChange={handleBranchChange}
          >
            <option value="">Select</option>
            {canSelectAllBranches && <option value="all">All</option>}
            {selectedBranchId &&
              selectedBranchId !== 'all' &&
              !findBranchById(branches, selectedBranchId) && (
                <option value={String(selectedBranchId)}>
                  {selectedBranchName || 'Selected Branch'}
                </option>
            )}
            {branches.map((branch, index) => (
              <option key={getBranchId(branch) || `branch-${index}`} value={String(getBranchId(branch) || '')}>
                {getBranchDisplayName(branch, `Branch ${index + 1}`)}
              </option>
            ))}
          </select>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
