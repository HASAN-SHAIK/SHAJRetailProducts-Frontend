const fs = require('fs');
const path = require('path');

const read = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');

const RESTORED = ['CustomerList.jsx', 'CustomerForm.jsx', 'CustomerDetail.jsx'];

describe('POS customer management boundary (Phase 2 / Stage 1)', () => {
  test('CustomerReorder remains a redirect stub back to store execution', () => {
    const source = read('CustomerReorder.jsx');
    expect(source).toContain('Navigate');
    expect(source).toContain('to="/billing/retail"');
    expect(source).not.toContain('credit_limit');
    expect(source).not.toContain('current_balance');
  });

  test.each(RESTORED)('%s is restored and no longer redirects', (file) => {
    const source = read(file);
    expect(source).not.toContain('<Navigate');
    expect(source).not.toContain('to="/billing/retail"');
  });

  test('restored screens go through the repository facade, never storage or the sync queue directly', () => {
    const combined = RESTORED.map(read).join('\n');
    expect(combined).toContain("from '../../services/local'");
    expect(combined).not.toContain('addSyncQueueItem(');
    expect(combined).not.toContain("from '../../utils/axios'");
    expect(combined).not.toMatch(/api\.(get|post|put|patch|delete)\(/);
    expect(combined).not.toContain('Repositories/internal/storage');
  });

  test('form uses the local-POS capability check so offline/local writes stay supported', () => {
    const form = read('CustomerForm.jsx');
    expect(form).toContain('isLocalPosEnabled');
    expect(form).toContain('createCustomer(');
    expect(form).toContain('updateCustomer(');
  });

  test('detail screen reports unavailable history instead of implying none exists', () => {
    const detail = read('CustomerDetail.jsx');
    expect(detail).toContain('history is not available on this device right now');
  });
});
