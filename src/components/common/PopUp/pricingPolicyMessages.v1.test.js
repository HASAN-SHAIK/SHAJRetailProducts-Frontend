import { normalizePopupContent } from './PopupProvider';

describe('V1 actionable POS pricing and tax rejection messages', () => {
  test.each([
    ['price_override_not_allowed', 'Price policy', 'Manual price override is not allowed by the current store policy.', 'warning'],
    ['discount_not_allowed', 'Discount policy', 'Discounts are disabled by the current store policy.', 'warning'],
    ['discount_limit_exceeded', 'Discount policy', 'Discount exceeds the maximum allowed by the current store policy.', 'warning'],
    ['pricing_policy_unavailable', 'Pricing policy unavailable', 'Pricing policy is unavailable. Retry after POS configuration refreshes.', 'error'],
    ['tax_policy_unavailable', 'Tax policy unavailable', 'Tax policy is unavailable. Retry after POS configuration refreshes.', 'error'],
    ['tax_policy_invalid', 'Tax policy error', 'Tax policy configuration is invalid. Contact an administrator before checkout.', 'error'],
  ])('%s is presented as an actionable cashier message', (code, title, message, type) => {
    expect(normalizePopupContent(code, 'Local POS unavailable')).toEqual({ title, message, type });
  });

  test('unrelated popup content retains the existing title and inferred type behavior', () => {
    expect(normalizePopupContent('Customer is required.', 'Validation')).toEqual({
      title: 'Validation',
      message: 'Customer is required.',
      type: 'warning',
    });
  });
});
