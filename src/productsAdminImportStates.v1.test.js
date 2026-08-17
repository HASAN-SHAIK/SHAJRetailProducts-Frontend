import fs from 'fs';
import path from 'path';

const readProductsPage = () =>
  fs.readFileSync(path.join(__dirname, 'components/ProductsPage/ProductsPage.jsx'), 'utf8');

describe('V1 product/admin import screen states', () => {
  test('requires an explicit branch and confirmation before canonical import', () => {
    const source = readProductsPage();

    expect(source).toContain("if (!effectiveBranchId)");
    expect(source).toContain("showPopup('Select a branch before importing products.', 'Validation')");
    expect(source).toContain('const importConfirmed = window.confirm(');
    expect(source).toContain("api.post('/products/import-rows', { rows: payloadRows })");
  });

  test('surfaces deterministic parsing, validation, loading and import errors', () => {
    const source = readProductsPage();

    expect(source).toContain('setImportParsing(true)');
    expect(source).toContain("setImportPreviewError('No valid rows found in file.')");
    expect(source).toContain('setImportPreviewError(message)');
    expect(source).toContain('setImporting(true)');
    expect(source).toContain('setImportError(message)');
    expect(source).toContain("? `Importing${'.'.repeat(importDots)}`");
    expect(source).toContain('disabled={importing || importParsing || (importPreviewRows.length > 0 && importMissingRequired > 0)}');
  });

  test('refreshes canonical product presentation after a successful import', () => {
    const source = readProductsPage();

    expect(source).toContain("showPopup('Imported Successfully', 'Success')");
    expect(source).toContain('setForceApiFetch(true)');
    expect(source).toContain('setProductUpdateFlag((prev) => !prev)');
    expect(source).toContain('setImportResult({');
    expect(source).toContain('errors: Array.isArray(summary.errors) ? summary.errors : []');
  });
});
