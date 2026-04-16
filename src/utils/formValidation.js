export const collectValidationErrors = (rules = []) => {
  const errors = {};
  rules.forEach((rule) => {
    if (!rule?.key) return;
    const valid = typeof rule.validate === 'function' ? rule.validate() : true;
    if (!valid && rule.message) {
      errors[rule.key] = rule.message;
    }
  });
  return errors;
};

export const firstValidationMessage = (errors = {}, fallback = 'Please review required fields.') => {
  const keys = Object.keys(errors);
  if (keys.length === 0) return '';
  return errors[keys[0]] || fallback;
};
