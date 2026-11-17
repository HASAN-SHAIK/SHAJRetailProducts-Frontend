// Optional GST fields for the thermal receipt payload (POST {print}/print).
//
// The print service prints `gstin`, `cgst`, `sgst`, `igst` when present and
// keeps its owner-approved layout when they are absent; older print services
// ignore unknown fields. This helper only ADDS fields — it never changes the
// existing `gst`, `subtotal`, `discount` or `total` values.

const toPaise = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
};

const fromPaise = (paise) => paise / 100;

const firstPositive = (source, keys) => {
  if (!source || typeof source !== 'object') return 0;
  for (const key of keys) {
    const paise = toPaise(source[key]);
    if (paise > 0) return paise;
  }
  return 0;
};

const CGST_KEYS = ['cgst', 'cgst_amount', 'cgst_total'];
const SGST_KEYS = ['sgst', 'sgst_amount', 'sgst_total'];
const IGST_KEYS = ['igst', 'igst_amount', 'igst_total'];

/** First non-empty GSTIN from the candidates, trimmed and upper-cased; '' when none. */
export const resolveGstin = (...candidates) => {
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;
    const text = String(candidate).trim();
    if (text) return text.toUpperCase();
  }
  return '';
};

/**
 * Intra-state split of a GST total into CGST + SGST (2 decimals) so that
 * cgst + sgst === gst exactly (in paise). An odd paisa always goes to SGST.
 * Returns null when the GST total is zero, negative or absent.
 */
export const splitGst = (gst) => {
  const totalPaise = toPaise(gst);
  if (totalPaise <= 0) return null;
  const cgstPaise = Math.floor(totalPaise / 2);
  const sgstPaise = totalPaise - cgstPaise;
  return { cgst: fromPaise(cgstPaise), sgst: fromPaise(sgstPaise) };
};

/**
 * Builds the optional receipt fields to spread into the print payload.
 *
 * @param {object} params
 * @param {number} params.gst      The GST total already sent as `gst`.
 * @param {object} [params.order]  Order object that may carry real
 *                                 cgst/sgst/igst values (preferred when present).
 * @param {string} [params.gstin]  Shop GSTIN (already resolved); omitted when empty.
 * @returns {{gstin?: string, cgst?: number, sgst?: number, igst?: number}}
 */
export const buildReceiptTaxFields = ({ gst, order, gstin } = {}) => {
  const fields = {};
  const resolvedGstin = resolveGstin(gstin);
  if (resolvedGstin) fields.gstin = resolvedGstin;

  const igstPaise = firstPositive(order, IGST_KEYS);
  const cgstPaise = firstPositive(order, CGST_KEYS);
  const sgstPaise = firstPositive(order, SGST_KEYS);

  if (igstPaise > 0) {
    // Inter-state sale: IGST only.
    fields.igst = fromPaise(igstPaise);
    return fields;
  }
  if (cgstPaise > 0 || sgstPaise > 0) {
    fields.cgst = fromPaise(cgstPaise);
    fields.sgst = fromPaise(sgstPaise);
    return fields;
  }

  const split = splitGst(gst);
  if (split) {
    fields.cgst = split.cgst;
    fields.sgst = split.sgst;
  }
  return fields;
};
