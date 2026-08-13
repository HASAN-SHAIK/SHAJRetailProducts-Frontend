const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/components/ProductsPage/ProductsPage.jsx');
const adapterPath = path.join(process.cwd(), 'src/components/ProductsPage/WeightedImportAdapter.jsx');
const indexPath = path.join(process.cwd(), 'src/components/ProductsPage/index.js');
let source = fs.readFileSync(filePath, 'utf8');

const adapterIsActive =
  fs.existsSync(adapterPath) &&
  fs.existsSync(indexPath) &&
  fs.readFileSync(indexPath, 'utf8').includes("export { default } from './WeightedImportAdapter'");

if (adapterIsActive) {
  console.log('[customer-fix] weighted product import adapter already active');
  process.exit(0);
}

const replaceRequired = (label, before, after) => {
  if (source.includes(after)) return;
  if (!source.includes(before)) {
    throw new Error(`Customer weighted import patch failed: missing ${label}`);
  }
  source = source.replace(before, after);
};

replaceRequired(
  'weight header aliases',
  `    'batch no': 'batch_number',\n    expiry: 'expiry_date',`,
  `    'batch no': 'batch_number',\n    'is weight based': 'is_weight_based',\n    is_weight_based: 'is_weight_based',\n    weight_based: 'is_weight_based',\n    isweightbased: 'is_weight_based',\n    weightbased: 'is_weight_based',\n    'product type': 'is_weight_based',\n    product_type: 'is_weight_based',\n    producttype: 'is_weight_based',\n    'unit type': 'is_weight_based',\n    unit_type: 'is_weight_based',\n    unittype: 'is_weight_based',\n    type: 'is_weight_based',\n    expiry: 'expiry_date',`
);

replaceRequired(
  'weight value normalizer',
  `  const toDateInput = (value) => {`,
  `  const toWeightFlag = (value, fallback = '0') => {\n    if (value === null || value === undefined || value === '') return String(fallback);\n    if (value === true) return '1';\n    if (value === false) return '0';\n    if (typeof value === 'number') return value !== 0 ? '1' : '0';\n    const normalized = String(value).trim().toLowerCase();\n    if (['1', 'true', 'yes', 'y', 'weight', 'weighted', 'weight based', 'weight-based', 'kg', 'kgs', 'gram', 'grams'].includes(normalized)) return '1';\n    if (['0', 'false', 'no', 'n', 'piece', 'pieces', 'piece based', 'piece-based', 'pcs', 'pc', 'unit', 'units'].includes(normalized)) return '0';\n    return String(fallback);\n  };\n  const toDateInput = (value) => {`
);

replaceRequired(
  'parsed weight value',
  `        const expiry_date = toDateInput(row.expiry_date);\n        return {`,
  `        const expiry_date = toDateInput(row.expiry_date);\n        const is_weight_based = toWeightFlag(row.is_weight_based, defaultWeightValue);\n        return {`
);

replaceRequired(
  'parsed weight field',
  `          batch_number,\n          expiry_date,\n          selling_price`,
  `          batch_number,\n          expiry_date,\n          is_weight_based,\n          selling_price`
);

replaceRequired(
  'import payload weight field',
  `      expiry_date: row.expiry_date ? String(row.expiry_date).trim() : null,\n      selling_price:`,
  `      expiry_date: row.expiry_date ? String(row.expiry_date).trim() : null,\n      is_weight_based: toWeightFlag(row.is_weight_based, defaultWeightValue),\n      selling_price:`
);

replaceRequired(
  'preview type header',
  `                          <th>Barcode</th>\n                          <th className="text-end">Stock</th>`,
  `                          <th>Barcode</th>\n                          <th>Type</th>\n                          <th className="text-end">Stock</th>`
);

replaceRequired(
  'preview type editor',
  `                            <td>\n                              <input\n                                className="form-control form-control-sm text-end"\n                                type="number"\n                                step="0.01"\n                                value={row.stock_quantity}`,
  `                            <td>\n                              <select\n                                className="form-select form-select-sm"\n                                value={toWeightFlag(row.is_weight_based, defaultWeightValue)}\n                                onChange={(event) => updatePreviewRow(idx, 'is_weight_based', event.target.value)}\n                              >\n                                {pieceBasedEnabled && <option value="0">Piece-based</option>}\n                                {weightBasedEnabled && <option value="1">Weight-based</option>}\n                              </select>\n                            </td>\n                            <td>\n                              <input\n                                className="form-control form-control-sm text-end"\n                                type="number"\n                                step={toWeightFlag(row.is_weight_based, defaultWeightValue) === '1' ? '0.001' : '1'}\n                                value={row.stock_quantity}`
);

fs.writeFileSync(filePath, source);
console.log('[customer-fix] weighted product import parser/preview enabled');
