export const GST_MODES = {
  INCLUSIVE: 'INCLUSIVE',
  EXCLUSIVE: 'EXCLUSIVE',
};

export const normalizeGstMode = (value, fallback = GST_MODES.INCLUSIVE) => {
  if (value === undefined || value === null || value === '') return fallback;
  const mode = String(value).trim().toUpperCase();
  if (mode === GST_MODES.INCLUSIVE || mode === GST_MODES.EXCLUSIVE) return mode;
  return fallback;
};

export const calculateGST = ({ price, qty, gstPercent, gstMode }) => {
  const p = Number(price) || 0;
  const q = Number(qty) || 0;
  const g = Number(gstPercent) || 0;
  const mode = normalizeGstMode(gstMode);

  let basePrice = 0;
  let gstAmount = 0;
  let total = 0;

  if (mode === GST_MODES.INCLUSIVE) {
    basePrice = g > 0 ? p / (1 + g / 100) : p;
    gstAmount = p - basePrice;
    total = p;
  } else {
    basePrice = p;
    gstAmount = (p * g) / 100;
    total = p + gstAmount;
  }

  return {
    basePrice: basePrice * q,
    gstAmount: gstAmount * q,
    total: total * q,
    gstMode: mode,
  };
};

export const resolveGstModeFromConfig = (config) => {
  const mode =
    config?.gst_mode ||
    config?.gstMode ||
    config?.gst_mode?.mode ||
    null;
  return normalizeGstMode(mode);
};
