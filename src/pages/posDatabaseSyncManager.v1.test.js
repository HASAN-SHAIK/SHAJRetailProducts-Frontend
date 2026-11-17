const fs = require('fs');
const path = require('path');

const managerSource = fs.readFileSync(
  path.join(__dirname, '../components/PosSetup/PosDatabaseSyncManager.jsx'),
  'utf8'
);
const setupScreenSource = fs.readFileSync(path.join(__dirname, 'SetupScreen.jsx'), 'utf8');
const appSource = fs.readFileSync(path.join(__dirname, '../App.js'), 'utf8');

describe('V1 POS Offline Database Permission & Sequential Downloader', () => {
  describe('PosDatabaseSyncManager Component Wiring', () => {
    test('detects device type (mobile vs laptop) and surfaces device-specific context', () => {
      expect(managerSource).toContain('detectDeviceProfile()');
      expect(managerSource).toContain('pos-device-badge--${device.type}');
      expect(managerSource).toContain('{device.label} Detected');
      expect(managerSource).toContain("device.isMobile ? 'Mobile Billing Mode' : 'Workstation Terminal'");
    });

    test('asks permission to download database before syncing', () => {
      expect(managerSource).toContain('Prepare POS Database for Offline Use?');
      expect(managerSource).toContain('📥 Download Database & Dependencies');
      expect(managerSource).toContain('⚡ Continue Online (Skip Download)');
      expect(managerSource).toContain('Remember my choice on this device');
    });

    test('downloads dependencies one by one with sequential progress and retry capability', () => {
      expect(managerSource).toContain('downloadDependenciesOneByOne');
      expect(managerSource).toContain('Downloading Dependencies One by One...');
      expect(managerSource).toContain('Step {overallProgress.completedSteps + 1} of {DEPENDENCY_STEPS.length}');
      expect(managerSource).toContain('pos-step-card--${state.status}');
      expect(managerSource).toContain('Retry');
    });

    test('provides a friction-free skip path so user is never locked in a hectic state', () => {
      expect(managerSource).toContain('handleSkip');
      expect(managerSource).toContain('Working in Live Server Mode');
      expect(managerSource).toContain('In a rush? Continue to POS Online');
    });

    test('provides instant action to start billing immediately once completed', () => {
      expect(managerSource).toContain('POS Database Ready!');
      expect(managerSource).toContain('🚀 Start Billing Now');
      expect(managerSource).toContain('handleProceedImmediately');
    });
  });

  describe('SetupScreen Integration', () => {
    test('mounts PosDatabaseSyncManager into SetupScreen with required completion handler', () => {
      expect(setupScreenSource).toContain('<PosDatabaseSyncManager');
      expect(setupScreenSource).toContain('userDetails={userDetails}');
      expect(setupScreenSource).toContain('branchId={selectedBranchId}');
      expect(setupScreenSource).toContain('onComplete={handleSetupComplete}');
    });

    test('routes mobile users to /m/neworder and laptop users to /billing/retail upon completion', () => {
      expect(setupScreenSource).toContain("isMobileDevice && mobileAccessEnabled ? '/m/neworder' : '/billing/retail'");
      expect(setupScreenSource).toContain('navigate(targetRoute, { replace: true });');
    });
  });

  describe('App.js Setup Authority Boundary', () => {
    test('delegates database download permission to SetupScreen instead of forcing sync beforehand', () => {
      expect(appSource).toContain('Navigation and offline database synchronization are coordinated by SetupScreen');
      expect(appSource).not.toMatch(/runSetup[\s\S]*?runAppSyncCycle[\s\S]*?setSetupReady/);
    });
  });
});
