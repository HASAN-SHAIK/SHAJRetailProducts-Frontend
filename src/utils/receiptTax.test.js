import fs from 'fs';
import path from 'path';
import { buildReceiptTaxFields, resolveGstin, splitGst } from './receiptTax';

describe('splitGst', () => {
  test('even paise split exactly in half', () => {
    expect(splitGst(18)).toEqual({ cgst: 9, sgst: 9 });
    expect(splitGst(10.5)).toEqual({ cgst: 5.25, sgst: 5.25 });
  });

  test('odd paisa always goes to SGST and the halves sum to gst exactly', () => {
    expect(splitGst(10.01)).toEqual({ cgst: 5, sgst: 5.01 });
    expect(splitGst(0.01)).toEqual({ cgst: 0, sgst: 0.01 });
    [0.03, 1.11, 7.77, 99.99, 123.45, 0.1 + 0.2].forEach((gst) => {
      const { cgst, sgst } = splitGst(gst);
      expect(Math.round(cgst * 100) + Math.round(sgst * 100)).toBe(Math.round(gst * 100));
      expect(sgst).toBeGreaterThanOrEqual(cgst);
    });
  });

  test('zero, negative or absent GST yields no split', () => {
    [0, -5, null, undefined, '', 'abc', NaN].forEach((gst) => {
      expect(splitGst(gst)).toBeNull();
    });
  });
});

describe('resolveGstin', () => {
  test('returns first non-empty candidate, trimmed and upper-cased', () => {
    expect(resolveGstin(null, '  ', ' 36abcde1234f1z5 ', 'OTHER')).toBe('36ABCDE1234F1Z5');
  });

  test('returns empty string when nothing is set', () => {
    expect(resolveGstin()).toBe('');
    expect(resolveGstin(undefined, null, '   ')).toBe('');
  });
});

describe('buildReceiptTaxFields', () => {
  test('splits gst half/half and includes gstin when present', () => {
    expect(buildReceiptTaxFields({ gst: 36.01, gstin: '36abcde1234f1z5' })).toEqual({
      gstin: '36ABCDE1234F1Z5',
      cgst: 18,
      sgst: 18.01,
    });
  });

  test('zero or absent GST sends no split and no empty gstin', () => {
    expect(buildReceiptTaxFields({ gst: 0, gstin: '' })).toEqual({});
    expect(buildReceiptTaxFields({})).toEqual({});
    expect(buildReceiptTaxFields()).toEqual({});
  });

  test('prefers real cgst/sgst on the order over the half split', () => {
    const order = { cgst_amount: '4.50', sgst_amount: 4.5 };
    expect(buildReceiptTaxFields({ gst: 10, order })).toEqual({ cgst: 4.5, sgst: 4.5 });
  });

  test('real igst on the order sends igst only (inter-state)', () => {
    const order = { igst: 18, cgst: 0, sgst: 0 };
    expect(buildReceiptTaxFields({ gst: 18, order, gstin: 'X' })).toEqual({ gstin: 'X', igst: 18 });
  });

  test('order without tax fields falls back to the split', () => {
    expect(buildReceiptTaxFields({ gst: 5, order: { id: 1 } })).toEqual({ cgst: 2.5, sgst: 2.5 });
  });
});

describe('receipt print call sites send the GST fields (source contract)', () => {
  const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  const sites = {
    RetailBilling: read('pages/billing/RetailBilling.jsx'),
    OrdersPage: read('components/OrdersPage/OrdersPage.js'),
  };

  Object.entries(sites).forEach(([name, source]) => {
    test(`${name} spreads buildReceiptTaxFields (gstin, cgst, sgst) into the /print body`, () => {
      expect(source).toMatch(/import\s*\{[^}]*buildReceiptTaxFields[^}]*\}\s*from\s*'[./]+utils\/receiptTax'/);
      const printIdx = source.indexOf('/print`');
      expect(printIdx).toBeGreaterThan(-1);
      const body = source.slice(printIdx, printIdx + 1500);
      expect(body).toMatch(/\.\.\.\s*buildReceiptTaxFields\(\{[^}]*gst[^}]*gstin[^}]*\}\)/s);
      // existing fields remain
      ['subtotal', 'gst', 'discount', 'total', 'shopName', 'printConfig'].forEach((field) => {
        expect(body).toMatch(new RegExp(`\\b${field}\\b`));
      });
    });
  });
});
