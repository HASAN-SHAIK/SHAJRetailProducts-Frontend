import fs from 'fs';
import path from 'path';
import {
  buildReceiptTaxFields,
  extractGstinStateCode,
  isInterStateSale,
  resolveGstin,
  splitGst,
} from './receiptTax';

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

describe('extractGstinStateCode', () => {
  test('extracts 2-digit numeric state code', () => {
    expect(extractGstinStateCode('36ABCDE1234F1Z5')).toBe('36');
    expect(extractGstinStateCode(' 27AABCT1332L1ZV ')).toBe('27');
    expect(extractGstinStateCode('07AAAAA0000A1Z5')).toBe('07');
  });

  test('returns empty string for missing, invalid or non-numeric codes', () => {
    expect(extractGstinStateCode('')).toBe('');
    expect(extractGstinStateCode(null)).toBe('');
    expect(extractGstinStateCode('ABCDE1234F')).toBe('');
    expect(extractGstinStateCode('3')).toBe('');
  });
});

describe('isInterStateSale', () => {
  test('returns true when shop and customer state codes differ', () => {
    expect(
      isInterStateSale({
        shopGstin: '36ABCDE1234F1Z5',
        customerGstin: '27AABCT1332L1ZV',
      })
    ).toBe(true);
  });

  test('returns false when shop and customer are in the same state', () => {
    expect(
      isInterStateSale({
        shopGstin: '36ABCDE1234F1Z5',
        customerGstin: '36XYZWE9999P1Z1',
      })
    ).toBe(false);
  });

  test('returns false when customer has no GSTIN (retail intra-state sale)', () => {
    expect(isInterStateSale({ shopGstin: '36ABCDE1234F1Z5' })).toBe(false);
    expect(isInterStateSale({ shopGstin: '36ABCDE1234F1Z5', customerGstin: '' })).toBe(false);
  });

  test('respects explicit boolean override', () => {
    expect(isInterStateSale({ isInterState: true })).toBe(true);
    expect(
      isInterStateSale({
        isInterState: false,
        shopGstin: '36ABCDE1234F1Z5',
        customerGstin: '27AABCT1332L1ZV',
      })
    ).toBe(false);
  });

  test('detects inter-state from order properties', () => {
    expect(isInterStateSale({ order: { is_inter_state: true } })).toBe(true);
    expect(isInterStateSale({ order: { igst: 18 } })).toBe(true);
    expect(
      isInterStateSale({
        shopGstin: '36ABCDE1234F1Z5',
        order: { customer_gstin: '33AABCT1332L1ZV' },
      })
    ).toBe(true);
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

  test('inter-state sale via customer GSTIN sends 100% IGST instead of CGST/SGST split', () => {
    expect(
      buildReceiptTaxFields({
        gst: 18,
        gstin: '36ABCDE1234F1Z5',
        customerGstin: '27AABCT1332L1ZV',
      })
    ).toEqual({
      gstin: '36ABCDE1234F1Z5',
      igst: 18,
    });
  });

  test('explicit isInterState sends 100% IGST', () => {
    expect(
      buildReceiptTaxFields({
        gst: 24.5,
        gstin: '36ABCDE1234F1Z5',
        isInterState: true,
      })
    ).toEqual({
      gstin: '36ABCDE1234F1Z5',
      igst: 24.5,
    });
  });

  test('same-state customer GSTIN splits 50/50 to CGST and SGST', () => {
    expect(
      buildReceiptTaxFields({
        gst: 18,
        gstin: '36ABCDE1234F1Z5',
        customerGstin: '36XYZWE9999P1Z1',
      })
    ).toEqual({
      gstin: '36ABCDE1234F1Z5',
      cgst: 9,
      sgst: 9,
    });
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
