import fs from 'fs';
import path from 'path';

const readReportsMobile = () =>
  fs.readFileSync(path.join(__dirname, 'ReportsMobile.jsx'), 'utf8');

describe('V1 mobile reporting truth states', () => {
  test('does not present non-functional custom date filters as canonical reporting input', () => {
    const source = readReportsMobile();

    expect(source).not.toContain('From Date');
    expect(source).not.toContain('To Date');
    expect(source).not.toContain('fromDate');
    expect(source).not.toContain('toDate');
    expect(source).toContain('Custom date-range reporting is not exposed on this V1 mobile screen.');
  });

  test('does not turn an unavailable canonical report into fake zero revenue', () => {
    const source = readReportsMobile();

    expect(source).toContain("if (!payload)");
    expect(source).toContain("return 'Unavailable'");
    expect(source).toContain('Sales reporting is unavailable.');
    expect(source).toContain('role="alert"');
  });

  test('provides an explicit retry for unavailable report data', () => {
    const source = readReportsMobile();

    expect(source).toContain('onClick={fetchSummary}');
    expect(source).toContain("{loading ? 'Retrying...' : 'Retry report'}");
    expect(source).toContain("aria-busy={loading ? 'true' : 'false'}");
  });
});
