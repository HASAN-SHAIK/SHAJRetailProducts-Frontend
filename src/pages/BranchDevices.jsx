import React, { useEffect, useMemo, useState } from 'react';
import { useBranchStore } from '../store/branchStore';
import { useSelector } from 'react-redux';
import api from '../utils/axios';
import {
  getLocalPosDevice,
  isLocalPosEnabled,
  registerLocalPosDevice,
} from '../Repositories/local/posLocalApiClient';
import './BranchDevices.css';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
};

const localErrorMessage = (error) => {
  const code = String(error?.message || '');
  if (code === 'local_pos_token_unavailable') {
    return 'Local POS token is unavailable. Start this screen from the configured POS runtime.';
  }
  if (code.startsWith('local_pos_http_')) {
    return `Local POS Service rejected the request (${code.replace('local_pos_http_', '')}).`;
  }
  return error?.payload?.error || error?.message || 'Unable to contact Local POS Service.';
};

const BranchDevices = () => {
  const branches = useBranchStore((state) => state.branches);
  const selectedBranchId = useBranchStore((state) => state.selectedBranchId);
  const userRole = useSelector((state) => state.tenant.role);
  const effectiveBranchId = selectedBranchId && selectedBranchId !== 'all' ? String(selectedBranchId) : null;

  const [devices, setDevices] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [localDevice, setLocalDevice] = useState(null);
  const [localDeviceError, setLocalDeviceError] = useState('');
  const [terminalId, setTerminalId] = useState('POS-01');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const branchName = useMemo(() => {
    const branch = branches.find((item) => String(item.id) === effectiveBranchId);
    return branch?.name || branch?.branch_name || '';
  }, [branches, effectiveBranchId]);

  const localStoreId = localDevice?.store_id == null ? null : String(localDevice.store_id);
  const isLocalDeviceActive = String(localDevice?.status || '').toLowerCase() === 'active';
  const isBoundToSelectedBranch = Boolean(
    effectiveBranchId && isLocalDeviceActive && localStoreId === effectiveBranchId
  );
  const isBoundElsewhere = Boolean(
    effectiveBranchId && isLocalDeviceActive && localStoreId && localStoreId !== effectiveBranchId
  );

  const fetchDevices = async () => {
    if (!effectiveBranchId) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await api.get(`/branches/${effectiveBranchId}/devices`);
      const payload = res?.data?.data || res?.data || {};
      setDevices(payload.devices || []);
      setSummary({
        activeCount: payload.active_count || 0,
        branch: payload.branch || null,
      });
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load devices');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLocalDevice = async () => {
    if (!isLocalPosEnabled()) {
      setLocalDevice(null);
      setLocalDeviceError('Local POS API is disabled for this frontend.');
      return null;
    }
    setLocalDeviceError('');
    try {
      const device = await getLocalPosDevice();
      setLocalDevice(device);
      if (device?.terminal_id) setTerminalId(String(device.terminal_id));
      return device;
    } catch (err) {
      setLocalDevice(null);
      setLocalDeviceError(localErrorMessage(err));
      return null;
    }
  };

  const refreshAll = async () => {
    await Promise.all([fetchDevices(), fetchLocalDevice()]);
  };

  useEffect(() => {
    fetchDevices();
  }, [effectiveBranchId]);

  useEffect(() => {
    fetchLocalDevice();
  }, []);

  const handleRegisterThisPos = async () => {
    if (!effectiveBranchId) {
      setError('Select the branch where this POS will operate.');
      return;
    }
    const normalizedTerminalId = terminalId.trim();
    if (!normalizedTerminalId) {
      setError('Terminal ID is required. Example: POS-01.');
      return;
    }

    setIsRegistering(true);
    setError('');
    setSuccess('');
    try {
      const device = localDevice || (await getLocalPosDevice());
      if (!device?.device_id) throw new Error('local_device_identity_missing');

      const currentStoreId = device.store_id == null ? null : String(device.store_id);
      const currentlyActive = String(device.status || '').toLowerCase() === 'active';
      if (currentlyActive && currentStoreId && currentStoreId !== effectiveBranchId) {
        throw new Error(`This POS is already bound to store ${currentStoreId}. Reassignment must be performed explicitly.`);
      }

      // Central authorization comes first. Always send POSService's real device_id explicitly;
      // the axios x-device-id header identifies the browser and is not the physical POS identity.
      await api.post(`/branches/${effectiveBranchId}/devices/register`, {
        device_id: device.device_id,
        device_name: normalizedTerminalId,
      });

      // Only persist the local store/terminal binding after Central accepted the device.
      const registered = await registerLocalPosDevice({
        storeId: effectiveBranchId,
        terminalId: normalizedTerminalId,
      });
      setLocalDevice(registered);
      setSuccess(`${normalizedTerminalId} is registered to ${branchName || `store ${effectiveBranchId}`} and ready for POS enrollment.`);
      await fetchDevices();
    } catch (err) {
      const centralMessage = err?.response?.data?.message || err?.response?.data?.error;
      setError(centralMessage || localErrorMessage(err));
      await fetchLocalDevice();
    } finally {
      setIsRegistering(false);
    }
  };

  const handleDeactivate = async (deviceId) => {
    if (!effectiveBranchId) return;
    setIsLoading(true);
    setError('');
    try {
      await api.patch(`/branches/${effectiveBranchId}/devices/${deviceId}/deactivate`);
      await fetchDevices();
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to deactivate device');
    } finally {
      setIsLoading(false);
    }
  };

  if (userRole !== 'admin') {
    return (
      <div className="branch-devices-page container mt-4">
        <h3 className="mb-2 text-light">Branch Devices</h3>
        <div className="alert alert-warning">Admin access only.</div>
      </div>
    );
  }

  return (
    <div className="branch-devices-page container mt-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h3 className="mb-1 text-light">Branch Devices</h3>
          <p className="text-secondary mb-0">Authorize and bind this physical POS to a branch.</p>
        </div>
        <button className="btn btn-outline-primary" onClick={refreshAll} disabled={isLoading || isRegistering}>
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {!effectiveBranchId && (
        <div className="alert alert-info">Select a branch before registering this POS.</div>
      )}

      {effectiveBranchId && (
        <div className="mb-3">
          <div className="card shadow-sm">
            <div className="card-body">
              <div className="d-flex flex-wrap gap-4">
                <div>
                  <div className="text-primary">Branch</div>
                  <div className="fw-semibold">{branchName || 'Selected Branch'}</div>
                </div>
                <div>
                  <div className="text-primary">Plan</div>
                  <div className="fw-semibold text-capitalize">
                    {summary?.branch?.subscription_plan || 'basic'}
                  </div>
                </div>
                <div>
                  <div className="text-primary">Active Devices</div>
                  <div className="fw-semibold">{summary?.activeCount ?? 0}</div>
                </div>
                <div>
                  <div className="text-primary">Limit</div>
                  <div className="fw-semibold">
                    {summary?.branch?.resolved_limit === null || summary?.branch?.resolved_limit === undefined
                      ? 'Unlimited'
                      : summary.branch.resolved_limit}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card shadow-sm mb-3 pos-registration-card">
        <div className="card-header text-secondary d-flex align-items-center justify-content-between">
          <strong>Register This POS</strong>
          {localDevice?.status && (
            <span className={`badge ${isLocalDeviceActive ? 'bg-success' : 'bg-secondary'}`}>
              {localDevice.status}
            </span>
          )}
        </div>
        <div className="card-body">
          {localDeviceError ? (
            <div className="alert alert-warning mb-0">{localDeviceError}</div>
          ) : localDevice ? (
            <>
              <div className="row g-3 align-items-end">
                <div className="col-12 col-lg-5">
                  <label className="form-label text-secondary">Local POS device ID</label>
                  <input className="form-control device-id-input" value={localDevice.device_id || ''} readOnly />
                  <div className="form-text text-secondary">Generated by POSService and used as the Central device identity.</div>
                </div>
                <div className="col-12 col-md-6 col-lg-3">
                  <label className="form-label text-secondary">Terminal ID</label>
                  <input
                    className="form-control"
                    value={terminalId}
                    onChange={(event) => setTerminalId(event.target.value)}
                    placeholder="POS-01"
                    maxLength={64}
                    disabled={isBoundToSelectedBranch || isBoundElsewhere || isRegistering}
                  />
                </div>
                <div className="col-12 col-md-6 col-lg-4 d-grid">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleRegisterThisPos}
                    disabled={!effectiveBranchId || isRegistering || isBoundToSelectedBranch || isBoundElsewhere}
                  >
                    {isRegistering ? 'Registering...' : isBoundToSelectedBranch ? 'POS Registered' : 'Register This POS'}
                  </button>
                </div>
              </div>

              <div className="mt-3 small text-secondary">
                Installation: <span className="device-code">{localDevice.installation_id || '—'}</span>
                {' · '}Local store: <strong>{localDevice.store_id || 'Not assigned'}</strong>
                {' · '}Terminal: <strong>{localDevice.terminal_id || 'Not assigned'}</strong>
              </div>

              {isBoundElsewhere && (
                <div className="alert alert-warning mt-3 mb-0">
                  This POS is already active on store {localStoreId}. Automatic cross-store reassignment is blocked to prevent accidental device movement.
                </div>
              )}
              {isBoundToSelectedBranch && (
                <div className="alert alert-success mt-3 mb-0">
                  This local POS is bound to the selected branch. Offline user enrollment and order creation can now use this store identity.
                </div>
              )}
            </>
          ) : (
            <div className="text-secondary">Checking Local POS Service...</div>
          )}
        </div>
      </div>

      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {effectiveBranchId && (
        <div className="card shadow-sm">
          <div className="card-header text-secondary">
            <strong>Registered Devices</strong>
          </div>
          <div className="card-body p-0">
            {devices.length === 0 ? (
              <div className="p-3 text-secondary">No devices registered yet.</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-striped mb-0">
                  <thead>
                    <tr>
                      <th>Device</th>
                      <th>Status</th>
                      <th>Last Login</th>
                      <th>IP</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.map((device) => (
                      <tr key={device.id}>
                        <td>
                          <div className="fw-semibold">{device.device_name || device.device_id}</div>
                          <div className="text-secondary small device-code">{device.device_id}</div>
                        </td>
                        <td>
                          {device.is_active ? (
                            <span className="badge bg-success">Active</span>
                          ) : (
                            <span className="badge bg-secondary">Inactive</span>
                          )}
                        </td>
                        <td>{formatDate(device.last_login_at)}</td>
                        <td>{device.ip_address || '—'}</td>
                        <td className="text-end">
                          {device.is_active && (
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleDeactivate(device.id)}
                              disabled={isLoading}
                            >
                              Deactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchDevices;
