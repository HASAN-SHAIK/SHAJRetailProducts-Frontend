import React, { useEffect, useMemo, useState } from 'react';
import { useBranchStore } from '../store/branchStore';
import { useSelector } from 'react-redux';
import api from '../utils/axios';
import './BranchDevices.css';

const formatDate = (value) => {
  if (!value) return 'â€”';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'â€”';
  return date.toLocaleString();
};

const BranchDevices = () => {
  const branches = useBranchStore((state) => state.branches);
  const selectedBranchId = useBranchStore((state) => state.selectedBranchId);
  const userRole = useSelector((state) => state.tenant.role);
  const effectiveBranchId = selectedBranchId && selectedBranchId !== 'all' ? selectedBranchId : null;

  const [devices, setDevices] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const branchName = useMemo(() => {
    const branch = branches.find((item) => item.id === effectiveBranchId);
    return branch?.name || '';
  }, [branches, effectiveBranchId]);

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
        branch: payload.branch || null
      });
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load devices');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, [effectiveBranchId]);

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
          <p className="text-secondary mb-0">Manage device access per branch.</p>
        </div>
        <button className="btn btn-outline-primary" onClick={fetchDevices} disabled={isLoading || !effectiveBranchId}>
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {!effectiveBranchId && (
        <div className="alert alert-info">Select a branch to view registered devices.</div>
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
                          <div className="text-secondary small">{device.browser_info || 'Unknown device'}</div>
                        </td>
                        <td>
                          {device.is_active ? (
                            <span className="badge bg-success">Active</span>
                          ) : (
                            <span className="badge bg-secondary">Inactive</span>
                          )}
                        </td>
                        <td>{formatDate(device.last_login_at)}</td>
                        <td>{device.ip_address || 'â€”'}</td>
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

