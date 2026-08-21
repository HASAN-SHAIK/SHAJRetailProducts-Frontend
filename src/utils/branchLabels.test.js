import { findBranchById, getBranchDisplayName, getBranchId, normalizeBranchLabel } from './branchLabels';

describe('branch label helpers', () => {
  test('normalizes invisible characters and whitespace', () => {
    expect(normalizeBranchLabel('  Matta\u200Bmpally   Branch  ')).toBe('Mattampally Branch');
  });

  test('resolves branch ids from common API shapes', () => {
    expect(getBranchId({ id: 10 })).toBe(10);
    expect(getBranchId({ branch_id: 'branch-1' })).toBe('branch-1');
    expect(getBranchId({ store_id: 'store-1' })).toBe('store-1');
  });

  test('resolves branch names from common API shapes', () => {
    expect(getBranchDisplayName({ name: 'Mattampally' })).toBe('Mattampally');
    expect(getBranchDisplayName({ branch_name: 'Main Counter' })).toBe('Main Counter');
    expect(getBranchDisplayName({ branchName: 'North Store' })).toBe('North Store');
    expect(getBranchDisplayName({ store_name: 'Local POS' })).toBe('Local POS');
    expect(getBranchDisplayName({ terminal_id: 'Mattampally-POS-1' })).toBe('Mattampally-POS-1');
    expect(getBranchDisplayName({}, 'Branch 1')).toBe('Branch 1');
  });

  test('finds branches by alternate id fields', () => {
    const branches = [{ branch_id: 'a', branch_name: 'A' }, { store_id: 'b', store_name: 'B' }];
    expect(findBranchById(branches, 'a')?.branch_name).toBe('A');
    expect(findBranchById(branches, 'b')?.store_name).toBe('B');
  });
});
