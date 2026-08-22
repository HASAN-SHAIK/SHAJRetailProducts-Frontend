import fs from 'fs';
import path from 'path';

const readSyncCenter = () =>
  fs.readFileSync(path.join(process.cwd(), 'src', 'pages', 'SyncCenterContent.jsx'), 'utf8');

describe('V1 Sync Center observability presentation', () => {
  test('presents POSService operational truth with actionable refresh and failure states', () => {
    const source = readSyncCenter();

    expect(source).toContain("localPosRequest('/diagnostics')");
    expect(source).toContain("localPosRequest('/diagnostics/sync-events?limit=100')");
    expect(source).toContain('Local POS Sync Queues');
    expect(source).toContain('SQLite outbox and inbox status from POSService.');
    expect(source).toContain("'Local POS diagnostics unavailable'");
    expect(source).toContain("{posStats.databaseOK ? 'SQLite OK' : posDiagnosticsError || 'Unavailable'}");
    expect(source).toContain('Outbox Pending');
    expect(source).toContain('Outbox Failed');
    expect(source).toContain('dead-lettered');
    expect(source).toContain('Inbox Failed');
    expect(source).toContain('Customer Conflicts');
    expect(source).toContain('Backup & Restore Health');
    expect(source).toContain("onClick={() => loadQueues(true)}");
    expect(source).toContain("{refreshing ? 'Refreshing...' : 'Refresh'}");
    expect(source).toContain('Refresh Details');
    expect(source).toContain('Unable to load stuck sync event details.');
  });

  test('does not require recovery mutation to inspect stuck POS sync facts', () => {
    const source = readSyncCenter();
    expect(source).toContain('Needs Sync Details');
    expect(source).toContain('No stuck outbox events.');
    expect(source).toContain('No stuck inbox messages.');
    expect(source).toContain('<summary>View JSON</summary>');
    expect(source).toContain('event.last_error ||');
    expect(source).toContain('message.last_error ||');
    expect(source).toContain("handleSkipSyncMessage('outbox', event)");
    expect(source).toContain("handleSkipSyncMessage('inbox', message)");
    expect(source).toContain("localPosRequest(`/diagnostics/${queue}/${encodeURIComponent(id)}/skip`");
  });
});
