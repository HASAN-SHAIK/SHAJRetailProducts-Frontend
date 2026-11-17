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
 * Extracts the 2-digit Indian GST state code from a candidate GSTIN string.
 * Returns a 2-digit string (e.g. '36', '33', '27') or '' when invalid/absent.
 */
export const extractGstinStateCode = (candidate) => {
  if (candidate === null || candidate === undefined) return '';
  const text = String(candidate).trim();
  if (text.length >= 2 && /^\d{2}/.test(text)) {
    return text.slice(0, 2);
  }
  return '';
};

/**
 * Determines whether a transaction is an inter-state sale under Indian GST rules.
 *
 * Rules:
 * - If `isInterState` boolean flag is explicitly passed, respect it.
 * - If `order` specifies `is_inter_state` or carries a positive IGST, it is inter-state.
 * - If both shop GSTIN and customer GSTIN have valid state codes, returns true when they differ.
 * - Defaults to false (intra-state B2C retail).
 */
export const isInterStateSale = ({ shopGstin, customerGstin, order, isInterState } = {}) => {
  if (typeof isInterState === 'boolean') return isInterState;
  if (order && typeof order.is_inter_state === 'boolean') return order.is_inter_state;
  if (order && typeof order.isInterState === 'boolean') return order.isInterState;
  if (firstPositive(order, IGST_KEYS) > 0) return true;

  const shopState = extractGstinStateCode(shopGstin);
  const custState = extractGstinStateCode(
    customerGstin ||
    order?.customer_gstin ||
    order?.customer_gst_number ||
    order?.customer?.gst_number ||
    order?.customer?.gstin
  );
  if (shopState && custState) {
    return shopState !== custState;
  }
  return false;
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
 * @param {number} params.gst             The GST total already sent as `gst`.
 * @param {object} [params.order]         Order object that may carry real
 *                                        cgst/sgst/igst values (preferred when present).
 * @param {string} [params.gstin]         Shop GSTIN (already resolved); omitted when empty.
 * @param {string} [params.customerGstin] Customer GSTIN for B2B transactions.
 * @param {boolean} [params.isInterState] Explicit override for inter-state sale.
 * @returns {{gstin?: string, cgst?: number, sgst?: number, igst?: number}}
 */
export const buildReceiptTaxFields = ({ gst, order, gstin, customerGstin, isInterState } = {}) => {
  const fields = {};
  const resolvedGstin = resolveGstin(gstin);
  if (resolvedGstin) fields.gstin = resolvedGstin;

  const totalPaise = toPaise(gst);
  if (totalPaise <= 0) return fields;

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

  // Check whether this transaction is an inter-state sale (e.g. out-of-state B2B customer)
  if (isInterStateSale({ shopGstin: resolvedGstin, customerGstin, order, isInterState })) {
    fields.igst = fromPaise(totalPaise);
    return fields;
  }

  const split = splitGst(gst);
  if (split) {
    fields.cgst = split.cgst;
    fields.sgst = split.sgst;
  }
  return fields;
};
