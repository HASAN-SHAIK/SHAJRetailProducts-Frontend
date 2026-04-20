const PLAN_ORDER = ['basic', 'pro', 'premium', 'enterprise'];

const FEATURE_ALIASES = {
  gst_invoice_enabled: ['GST_invoice_enabled', 'gst_enabled', 'enable_gst'],
  customer_details_enabled: ['customer_details_enabled', 'CUSTOMER_MODULE', 'require_customer_details'],
  whatsapp_bill_enabled: ['WHATSAPP_BILL', 'whatsapp_bill_module'],
  receipt_module_enabled: ['receipt_module_enabled', 'receipt_module', 'enable_receipt'],
  advanced_reports: ['advanced_reports', 'advancedReports'],
  analytical_reports: ['analytical_reports', 'analyticalReports'],
  reports_enabled: ['reports_enabled', 'enable_reports', 'advanced_reports', 'analytical_reports'],
  enable_barcode: ['enable_barcode'],
  mobile_access: ['mobile_access', 'MOBILE_ACCESS', 'mobile_module', 'mobile_module_enabled'],
  enable_weight_based: ['enable_weight_based', 'weight_based_enabled'],
  enable_piece_based: ['enable_piece_based', 'piece_based_enabled'],
  priority_support: ['priority_support']
};

const getRawTenantFeatures = (tenantConfig) => {
  const root = tenantConfig && typeof tenantConfig === 'object' ? tenantConfig : {};
  const featureSource = root.features || root.plan_features || {};
  return {
    ...root,
    ...(featureSource && typeof featureSource === 'object' ? featureSource : {}),
  };
};

const normalizeFeatureName = (featureName) => String(featureName || '').trim().toLowerCase();

const resolveFeatureState = (tenantConfig, featureName) => {
  const normalized = normalizeFeatureName(featureName);
  if (!normalized) return null;
  const raw = getRawTenantFeatures(tenantConfig);
  const aliases = FEATURE_ALIASES[normalized] || [normalized];
  const keys = [featureName, normalized, ...aliases].filter(Boolean);
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    if (raw[key] === true) return true;
    if (raw[key] === false) return false;
  }
  return null;
};

export const normalizePlanType = (value) => String(value || 'basic').trim().toLowerCase();

export const getTenantFeatures = (tenantConfig) => {
  const features = getRawTenantFeatures(tenantConfig);
  const out = { ...features };
  Object.entries(FEATURE_ALIASES).forEach(([key, aliases]) => {
    const enabled = resolveFeatureState(tenantConfig, key) === true;
    out[key] = enabled;
    aliases.forEach((alias) => {
      if (!Object.prototype.hasOwnProperty.call(out, alias)) {
        out[alias] = enabled;
      }
    });
  });
  return out;
};

export const hasFeature = (tenantConfig, featureName) => {
  return resolveFeatureState(tenantConfig, featureName) === true;
};

export const isFeatureEnabled = (tenantConfig, featureName, defaultValue = false) => {
  const state = resolveFeatureState(tenantConfig, featureName);
  if (state === null) return defaultValue === true;
  return state === true;
};

export const isPlanAtLeast = (tenantConfig, requiredPlan) => {
  const tenantPlan = normalizePlanType(
    tenantConfig?.subscription?.plan_name ||
      tenantConfig?.subscription?.planName ||
      tenantConfig?.plan_type ||
      tenantConfig?.planType
  );
  const required = normalizePlanType(requiredPlan);
  return PLAN_ORDER.indexOf(tenantPlan) >= PLAN_ORDER.indexOf(required);
};
