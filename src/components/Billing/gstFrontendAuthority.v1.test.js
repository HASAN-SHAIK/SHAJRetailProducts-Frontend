import fs from 'fs';
import path from 'path';

describe('V1 cashier GST authority', () => {
  const billingStoreSource = fs.readFileSync(
    path.join(__dirname, '../../store/billingStore.js'),
    'utf8'
  );
  const popupSource = fs.readFileSync(
    path.join(__dirname, 'GSTTogglePopup.jsx'),
    'utf8'
  );

  test('browser GST enable and mode mutations fail closed when local POS is authoritative', () => {
    expect(billingStoreSource).toContain("import { isLocalPosEnabled } from '../Repositories/local/posLocalApiClient';");
    expect(billingStoreSource).toMatch(/setGSTEnabled:\s*\(value\)\s*=>\s*\{\s*if \(isLocalPosEnabled\(\)\) return false;/s);
    expect(billingStoreSource).toMatch(/setGstMode:\s*\(mode\)\s*=>\s*\{\s*if \(isLocalPosEnabled\(\)\) return false;/s);
  });

  test('cashier GST popup becomes read-only POS policy presentation in local POS mode', () => {
    expect(popupSource).toContain('const localPosAuthoritative = isLocalPosEnabled();');
    expect(popupSource).toContain("GST is calculated by the local POS from Central policy and cannot be overridden here.");
    expect(popupSource).toContain("localPosAuthoritative ? 'GST Policy' : 'GST Override'");
    expect(popupSource).toMatch(/localPosAuthoritative \? \([\s\S]*role="status"[\s\S]*\) : \([\s\S]*onToggle\(event\.target\.checked\)/);
  });
});
