import fs from 'fs';
import path from 'path';

describe('Sales Return local POS return-history wiring', () => {
  const source = fs.readFileSync(path.join(__dirname, 'SalesReturn.jsx'), 'utf8');

  test('renders the read-only history panel only through the local POS mode contract', () => {
    expect(source).toContain("import ReturnHistoryPanel from './ReturnHistoryPanel';");
    expect(source).toContain('orderId={selectedOrderId}');
    expect(source).toContain('enabled={localPosMode}');
    expect(source).toContain('refreshKey={historyRefreshKey}');
  });

  test('refreshes history only after a successful local partial return', () => {
    const partialReturnCall = source.indexOf('await refundOrderPartial(selectedOrderId');
    const refreshCall = source.indexOf('setHistoryRefreshKey((value) => value + 1);');
    const centralReturnCall = source.indexOf('await createOrderReturn(selectedOrderId');

    expect(partialReturnCall).toBeGreaterThan(-1);
    expect(refreshCall).toBeGreaterThan(partialReturnCall);
    expect(centralReturnCall).toBeGreaterThan(refreshCall);
  });
});
