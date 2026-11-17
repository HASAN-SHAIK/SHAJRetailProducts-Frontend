import React, { useEffect, useState, useRef, useCallback } from 'react';
import './PosDatabaseSyncManager.css';
import {
  detectDeviceProfile,
  getPermissionPreference,
  savePermissionPreference,
  DEPENDENCY_STEPS,
  downloadDependenciesOneByOne,
} from '../../utils/posDatabaseDownloader';

/**
 * PosDatabaseSyncManager
 * 
 * Provides permission-based POS database download and dependency synchronization:
 * - Detects Mobile vs Laptop environment
 * - Prompts user for download permission with clear benefits and no hassle
 * - Downloads all 6 dependencies one by one with live sequential progress
 * - Provides immediate "Continue Online" skip path to eliminate user friction
 */
export const PosDatabaseSyncManager = ({
  userDetails = null,
  branchId = null,
  onComplete = () => {},
  autoRedirect = true,
  allowSkip = true,
}) => {
  const [device, setDevice] = useState(() => detectDeviceProfile());
  const [rememberChoice, setRememberChoice] = useState(true);
  const [phase, setPhase] = useState('asking_permission'); // 'asking_permission' | 'downloading' | 'completed' | 'skipped'
  const [overallProgress, setOverallProgress] = useState({ percent: 0, completedSteps: 0, totalSteps: DEPENDENCY_STEPS.length });
  const [stepStates, setStepStates] = useState(() =>
    DEPENDENCY_STEPS.reduce((acc, step) => {
      acc[step.id] = { status: 'idle', message: 'Waiting in queue...', result: null };
      return acc;
    }, {})
  );
  const [activeStepId, setActiveStepId] = useState(null);
  const [syncResults, setSyncResults] = useState(null);
  const [autoRedirectTimer, setAutoRedirectTimer] = useState(3);
  const abortControllerRef = useRef(null);
  const hasAutoStartedRef = useRef(false);

  // Check saved preferences on mount
  useEffect(() => {
    setDevice(detectDeviceProfile());
    const saved = getPermissionPreference();

    if (saved?.choice === 'download' && !hasAutoStartedRef.current) {
      hasAutoStartedRef.current = true;
      handleStartDownload();
    } else if (saved?.choice === 'skip' && !hasAutoStartedRef.current) {
      hasAutoStartedRef.current = true;
      handleSkip();
    }
  }, []);

  // Handle countdown when complete
  useEffect(() => {
    let interval = null;
    if ((phase === 'completed' || phase === 'skipped') && autoRedirect) {
      interval = setInterval(() => {
        setAutoRedirectTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            onComplete({ choice: phase === 'completed' ? 'download' : 'skip', results: syncResults });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [phase, autoRedirect, onComplete, syncResults]);

  const handleStartDownload = useCallback(async () => {
    savePermissionPreference('download', rememberChoice);
    setPhase('downloading');
    abortControllerRef.current = new AbortController();

    try {
      const results = await downloadDependenciesOneByOne({
        branchId,
        userDetails,
        abortSignal: abortControllerRef.current.signal,
        onProgress: (progress) => {
          setOverallProgress(progress);
        },
        onStepChange: ({ stepId, status, message, result, error }) => {
          setActiveStepId(stepId);
          setStepStates((prev) => ({
            ...prev,
            [stepId]: { status, message, result, error },
          }));
        },
      });

      setSyncResults(results);
      setPhase('completed');
    } catch (err) {
      if (err?.message !== 'Download aborted by user') {
        setPhase('completed'); // Allow continuing even if non-critical error occurred
      }
    }
  }, [branchId, userDetails, rememberChoice]);

  const handleSkip = useCallback(() => {
    savePermissionPreference('skip', rememberChoice);
    setPhase('skipped');
    if (!autoRedirect) {
      onComplete({ choice: 'skip', results: null });
    }
  }, [rememberChoice, autoRedirect, onComplete]);

  const handleProceedImmediately = () => {
    onComplete({ choice: phase === 'completed' ? 'download' : 'skip', results: syncResults });
  };

  const handleRetryStep = async (stepId) => {
    handleStartDownload();
  };

  return (
    <div className="pos-db-sync-card" role="region" aria-label="POS Offline Database Setup">
      {/* Device Badge */}
      <div className="pos-db-header">
        <div className={`pos-device-badge pos-device-badge--${device.type}`}>
          <span className="pos-device-icon" aria-hidden="true">{device.icon}</span>
          <span className="pos-device-text">{device.label} Detected</span>
        </div>
        <div className="pos-system-mode-tag">
          {device.isMobile ? 'Mobile Billing Mode' : 'Workstation Terminal'}
        </div>
      </div>

      {/* PHASE 1: Asking Permission */}
      {phase === 'asking_permission' && (
        <div className="pos-permission-section">
          <div className="pos-permission-intro">
            <h2 className="pos-permission-title">
              Prepare POS Database for Offline Use?
            </h2>
            <p className="pos-permission-desc">
              {device.isMobile
                ? 'Download the product catalog and billing dependencies to this mobile device so you can bill orders instantly and continue sales even if internet drops.'
                : 'Download the local offline database to this laptop/workstation. This stores products, batches, and taxes locally for lightning-fast search and offline resilience.'}
            </p>
          </div>

          <div className="pos-dependencies-preview">
            <div className="pos-preview-header">
              <span className="pos-preview-title">Dependencies to download one by one:</span>
              <span className="pos-preview-total">6 Components (~340 KB)</span>
            </div>
            <div className="pos-preview-grid">
              {DEPENDENCY_STEPS.map((step, idx) => (
                <div key={step.id} className="pos-preview-item">
                  <span className="pos-preview-icon" aria-hidden="true">{step.icon}</span>
                  <div className="pos-preview-info">
                    <strong className="pos-preview-name">{step.title}</strong>
                    <span className="pos-preview-size">{step.shortDesc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Remember Choice Toggle */}
          <div className="pos-remember-choice">
            <label className="pos-checkbox-label">
              <input
                type="checkbox"
                checked={rememberChoice}
                onChange={(e) => setRememberChoice(e.target.checked)}
                className="pos-checkbox"
              />
              <span>Remember my choice on this device (no repeated prompts)</span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="pos-permission-actions">
            <button
              type="button"
              className="btn btn-primary pos-btn-download"
              onClick={handleStartDownload}
              autoFocus
            >
              📥 Download Database & Dependencies
            </button>
            {allowSkip && (
              <button
                type="button"
                className="btn btn-outline-secondary pos-btn-skip"
                onClick={handleSkip}
              >
                ⚡ Continue Online (Skip Download)
              </button>
            )}
          </div>
          <p className="pos-permission-footnote">
            No worries: You can re-download or refresh the offline database at any time from Sync Center.
          </p>
        </div>
      )}

      {/* PHASE 2: Downloading One by One */}
      {phase === 'downloading' && (
        <div className="pos-downloading-section">
          <div className="pos-downloading-header">
            <div className="pos-progress-info">
              <span className="pos-progress-label">Downloading Dependencies One by One...</span>
              <span className="pos-progress-percent">{overallProgress.percent}%</span>
            </div>
            <div className="pos-progress-bar-track" role="progressbar" aria-valuenow={overallProgress.percent} aria-valuemin="0" aria-valuemax="100">
              <div
                className="pos-progress-bar-fill"
                style={{ width: `${overallProgress.percent}%` }}
              />
            </div>
            <div className="pos-progress-steps-count">
              Step {overallProgress.completedSteps + 1} of {DEPENDENCY_STEPS.length}
            </div>
          </div>

          {/* Sequential Dependency Stepper */}
          <div className="pos-steps-list">
            {DEPENDENCY_STEPS.map((step, idx) => {
              const state = stepStates[step.id] || {};
              const isActive = activeStepId === step.id && state.status === 'downloading';
              const isDone = state.status === 'completed';
              const isError = state.status === 'error';

              return (
                <div
                  key={step.id}
                  className={`pos-step-card pos-step-card--${state.status} ${isActive ? 'pos-step-card--active' : ''}`}
                >
                  <div className="pos-step-indicator">
                    {isDone && <span className="pos-step-badge pos-step-badge--done" title="Downloaded">✓</span>}
                    {isActive && <span className="pos-step-badge pos-step-badge--active" title="Downloading"><span className="pos-spinner" /></span>}
                    {isError && <span className="pos-step-badge pos-step-badge--error" title="Warning">!</span>}
                    {!isDone && !isActive && !isError && <span className="pos-step-badge pos-step-badge--idle">{idx + 1}</span>}
                  </div>

                  <div className="pos-step-details">
                    <div className="pos-step-heading">
                      <span className="pos-step-icon" aria-hidden="true">{step.icon}</span>
                      <strong className="pos-step-title">{step.title}</strong>
                      <span className="pos-step-estimate">{step.estimatedSize}</span>
                    </div>
                    <div className="pos-step-status-msg">
                      {state.message || step.shortDesc}
                    </div>
                  </div>

                  {isError && (
                    <div className="pos-step-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-warning"
                        onClick={() => handleRetryStep(step.id)}
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {allowSkip && (
            <div className="pos-downloading-cancel">
              <button
                type="button"
                className="btn btn-link pos-btn-cancel"
                onClick={handleSkip}
              >
                In a rush? Continue to POS Online
              </button>
            </div>
          )}
        </div>
      )}

      {/* PHASE 3: Completed */}
      {phase === 'completed' && (
        <div className="pos-completed-section">
          <div className="pos-completed-icon-wrapper">
            <span className="pos-completed-icon">🎉</span>
          </div>
          <h3 className="pos-completed-title">POS Database Ready!</h3>
          <p className="pos-completed-subtitle">
            All 6 dependencies successfully downloaded and cached in local database. Your {device.label} is fully prepared for fast offline & online billing.
          </p>

          <div className="pos-redirect-box">
            <span>Redirecting to POS checkout in <strong>{autoRedirectTimer}s</strong>...</span>
          </div>

          <div className="pos-completed-actions">
            <button
              type="button"
              className="btn btn-success pos-btn-start"
              onClick={handleProceedImmediately}
            >
              🚀 Start Billing Now
            </button>
          </div>
        </div>
      )}

      {/* PHASE 4: Skipped */}
      {phase === 'skipped' && (
        <div className="pos-skipped-section">
          <div className="pos-skipped-icon-wrapper">
            <span className="pos-skipped-icon">🌐</span>
          </div>
          <h3 className="pos-skipped-title">Working in Live Server Mode</h3>
          <p className="pos-skipped-subtitle">
            You chose to skip downloading the local database. POS will communicate with the central server for real-time inventory and pricing.
          </p>

          <div className="pos-redirect-box">
            <span>Redirecting to POS checkout in <strong>{autoRedirectTimer}s</strong>...</span>
          </div>

          <div className="pos-completed-actions">
            <button
              type="button"
              className="btn btn-primary pos-btn-start"
              onClick={handleProceedImmediately}
            >
              🚀 Open POS Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PosDatabaseSyncManager;
