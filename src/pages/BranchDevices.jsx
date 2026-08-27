import React, { useEffect, useMemo, useState } from 'react';
import { useBranchStore } from '../store/branchStore';
import { useSelector } from 'react-redux';
import api from '../utils/axios';
import { getLocalPosDevice, isLocalPosEnabled, registerLocalPosDevice } from '../Repositories/local/posLocalApiClient';
import { findBranchById, getBranchDisplayName } from '../utils/branchLabels';
import './BranchDevices.css';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};
const normalizeCode = (value) => String(value || '').trim().toUpperCase();
const localErrorMessage = (error) => {
  const code = String(error?.message || '');
  if (code === 'local_pos_token_unavailable') return 'Local POS token is unavailable. Start this screen from the configured POS runtime.';
  if (code.startsWith('local_pos_http_')) return `Local POS Service rejected the request (${code.replace('local_pos_http_', '')}).`;
  return error?.payload?.error || error?.message || 'Unable to contact Local POS Service.';
};

const BranchDevices = () => {
  const branches = useBranchStore((state) => state.branches);
  const selectedBranchId = useBranchStore((state) => state.selectedBranchId);
  const userRole = useSelector((state) => state.tenant.role);
  const effectiveBranchId = selectedBranchId && selectedBranchId !== 'all' ? String(selectedBranchId) : null;
  const selectedBranch = useMemo(() => findBranchById(branches, effectiveBranchId), [branches, effectiveBranchId]);
  const branchName = getBranchDisplayName(selectedBranch);
  const storeNumber = normalizeCode(selectedBranch?.store_number || selectedBranch?.storeNumber);

  const [devices, setDevices] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [localDevice, setLocalDevice] = useState(null);
  const [localDeviceError, setLocalDeviceError] = useState('');
  const [posNo, setPosNo] = useState('POS-01');
  const [touchpointId, setTouchpointId] = useState('TP-01');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const localStoreId = localDevice?.store_id == null ? null : String(localDevice.store_id);
  const isLocalDeviceActive = String(localDevice?.status || '').toLowerCase() === 'active';
  const hasCompleteLocalIdentity = Boolean(localDevice?.store_number && (localDevice?.pos_no || localDevice?.terminal_id) && localDevice?.touchpoint_id);
  const isBoundToSelectedBranch = Boolean(effectiveBranchId && isLocalDeviceActive && hasCompleteLocalIdentity && localStoreId === effectiveBranchId);
  const isBoundElsewhere = Boolean(effectiveBranchId && isLocalDeviceActive && localStoreId && localStoreId !== effectiveBranchId);

  const fetchDevices = async () => {
    if (!effectiveBranchId) return;
    setIsLoading(true); setError('');
    try {
      const res = await api.get(`/branches/${effectiveBranchId}/devices`);
      const payload = res?.data?.data || res?.data || {};
      setDevices(payload.devices || []);
      setSummary({ activeCount: payload.active_count || 0, branch: payload.branch || null });
    } catch (err) { setError(err?.response?.data?.message || 'Failed to load devices'); }
    finally { setIsLoading(false); }
  };

  const fetchLocalDevice = async () => {
    if (!isLocalPosEnabled()) { setLocalDevice(null); setLocalDeviceError('Local POS API is disabled for this frontend.'); return null; }
    setLocalDeviceError('');
    try {
      const device = await getLocalPosDevice();
      setLocalDevice(device);
      if (device?.pos_no || device?.terminal_id) setPosNo(String(device.pos_no || device.terminal_id));
      if (device?.touchpoint_id) setTouchpointId(String(device.touchpoint_id));
      return device;
    } catch (err) { setLocalDevice(null); setLocalDeviceError(localErrorMessage(err)); return null; }
  };

  const refreshAll = async () => { await Promise.all([fetchDevices(), fetchLocalDevice()]); };
  useEffect(() => { fetchDevices(); }, [effectiveBranchId]);
  useEffect(() => { fetchLocalDevice(); }, []);

  const handleRegisterThisPos = async () => {
    if (!effectiveBranchId) { setError('Select the store where this POS will operate.'); return; }
    if (!storeNumber) { setError('The selected branch does not have a Store Number. Add a Store Number before registering POS devices.'); return; }
    const normalizedPosNo = normalizeCode(posNo);
    const normalizedTouchpoint = normalizeCode(touchpointId);
    if (!normalizedPosNo || !normalizedTouchpoint) { setError('POS No and Touchpoint ID are required.'); return; }

    setIsRegistering(true); setError(''); setSuccess('');
    try {
      const device = localDevice || (await getLocalPosDevice());
      if (!device?.device_id) throw new Error('local_device_identity_missing');
      const currentStoreId = device.store_id == null ? null : String(device.store_id);
      const currentlyActive = String(device.status || '').toLowerCase() === 'active';
      if (currentlyActive && currentStoreId && currentStoreId !== effectiveBranchId) throw new Error(`This POS is already bound to store ${currentStoreId}. Reassignment must be performed explicitly.`);

      await api.post(`/branches/${effectiveBranchId}/devices/register`, {
        device_id: device.device_id,
        device_name: `${normalizedPosNo} / ${normalizedTouchpoint}`,
        store_number: storeNumber,
        pos_no: normalizedPosNo,
        touchpoint_id: normalizedTouchpoint,
      });

      const registered = await registerLocalPosDevice({
        storeId: effectiveBranchId,
        storeNumber,
        posNo: normalizedPosNo,
        touchpointId: normalizedTouchpoint,
      });
      setLocalDevice(registered);
      setSuccess(`Store ${storeNumber} / POS ${normalizedPosNo} / Touchpoint ${normalizedTouchpoint} is registered and ready for enrollment.`);
      await fetchDevices();
    } catch (err) {
      const centralMessage = err?.response?.data?.message || err?.response?.data?.error;
      setError(centralMessage || localErrorMessage(err));
      await fetchLocalDevice();
    } finally { setIsRegistering(false); }
  };

  const handleDeactivate = async (deviceId) => {
    if (!effectiveBranchId) return;
    setIsLoading(true); setError('');
    try { await api.patch(`/branches/${effectiveBranchId}/devices/${deviceId}/deactivate`); await fetchDevices(); }
    catch (err) { setError(err?.response?.data?.message || 'Failed to deactivate device'); }
    finally { setIsLoading(false); }
  };

  if (userRole !== 'admin') return <div className="branch-devices-page container mt-4"><h3 className="mb-2 text-light">POS & Devices</h3><div className="alert alert-warning">Admin access only.</div></div>;

  return (
    <div className="branch-devices-page container mt-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div><h3 className="mb-1 text-light">POS & Devices</h3><p className="text-secondary mb-0">Every POS is identified by Store Number + POS No + Touchpoint ID.</p></div>
        <button className="btn btn-outline-primary" onClick={refreshAll} disabled={isLoading || isRegistering}>{isLoading ? 'Refreshing...' : 'Refresh'}</button>
      </div>

      {!effectiveBranchId && <div className="alert alert-info">Select a store before registering this POS.</div>}
      {effectiveBranchId && <div className="mb-3"><div className="card shadow-sm"><div className="card-body"><div className="d-flex flex-wrap gap-4">
        <div><div className="text-primary">Store Number</div><div className="fw-semibold">{storeNumber || 'Not configured'}</div></div>
        <div><div className="text-primary">Store</div><div className="fw-semibold">{branchName || 'Selected Store'}</div></div>
        <div><div className="text-primary">Plan</div><div className="fw-semibold text-capitalize">{summary?.branch?.subscription_plan || 'basic'}</div></div>
        <div><div className="text-primary">Active Devices</div><div className="fw-semibold">{summary?.activeCount ?? 0}</div></div>
        <div><div className="text-primary">Limit</div><div className="fw-semibold">{summary?.branch?.resolved_limit == null ? 'Unlimited' : summary.branch.resolved_limit}</div></div>
      </div></div></div></div>}

      <div className="card shadow-sm mb-3 pos-registration-card">
        <div className="card-header text-secondary d-flex align-items-center justify-content-between"><strong>Register This POS</strong>{localDevice?.status && <span className={`badge ${isLocalDeviceActive ? 'bg-success' : 'bg-secondary'}`}>{localDevice.status}</span>}</div>
        <div className="card-body">
          {localDeviceError ? <div className="alert alert-warning mb-0">{localDeviceError}</div> : localDevice ? <>
            <div className="row g-3 align-items-end">
              <div className="col-12 col-lg-4"><label className="form-label text-secondary">Local Device ID</label><input className="form-control device-id-input" value={localDevice.device_id || ''} readOnly /></div>
              <div className="col-12 col-md-4 col-lg-2"><label className="form-label text-secondary">Store Number</label><input className="form-control" value={storeNumber} readOnly /></div>
              <div className="col-12 col-md-4 col-lg-2"><label className="form-label text-secondary">POS No</label><input className="form-control" value={posNo} onChange={(e)=>setPosNo(e.target.value.toUpperCase())} placeholder="POS-01" maxLength={64} disabled={isBoundToSelectedBranch || isBoundElsewhere || isRegistering}/></div>
              <div className="col-12 col-md-4 col-lg-2"><label className="form-label text-secondary">Touchpoint ID</label><input className="form-control" value={touchpointId} onChange={(e)=>setTouchpointId(e.target.value.toUpperCase())} placeholder="TP-01" maxLength={64} disabled={isBoundToSelectedBranch || isBoundElsewhere || isRegistering}/></div>
              <div className="col-12 col-lg-2 d-grid"><button type="button" className="btn btn-primary" onClick={handleRegisterThisPos} disabled={!effectiveBranchId || !storeNumber || isRegistering || isBoundToSelectedBranch || isBoundElsewhere}>{isRegistering ? 'Registering...' : isBoundToSelectedBranch ? 'POS Registered' : 'Register POS'}</button></div>
            </div>
            <div className="mt-3 small text-secondary">Installation: <span className="device-code">{localDevice.installation_id || '—'}</span>{' · '}Store: <strong>{localDevice.store_number || 'Not assigned'}</strong>{' · '}POS: <strong>{localDevice.pos_no || localDevice.terminal_id || 'Not assigned'}</strong>{' · '}Touchpoint: <strong>{localDevice.touchpoint_id || 'Not assigned'}</strong></div>
            {isBoundElsewhere && <div className="alert alert-warning mt-3 mb-0">This POS is already active on store {localStoreId}. Automatic cross-store reassignment is blocked.</div>}
            {isBoundToSelectedBranch && <div className="alert alert-success mt-3 mb-0">This POS has a complete Store/POS/Touchpoint identity and is active on the selected store.</div>}
          </> : <div className="text-secondary">Checking Local POS Service...</div>}
        </div>
      </div>

      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      {effectiveBranchId && <div className="card shadow-sm"><div className="card-header text-secondary"><strong>Registered Devices</strong></div><div className="card-body p-0">
        {devices.length === 0 ? <div className="p-3 text-secondary">No devices registered yet.</div> : <div className="table-responsive"><table className="table table-striped mb-0"><thead><tr><th>Device</th><th>Store</th><th>POS No</th><th>Touchpoint</th><th>Status</th><th>Last Login</th><th></th></tr></thead><tbody>
          {devices.map((device)=><tr key={device.id}><td><div className="fw-semibold">{device.device_name || device.device_id}</div><div className="text-secondary small device-code">{device.device_id}</div></td><td>{device.store_number || '—'}</td><td>{device.pos_no || '—'}</td><td>{device.touchpoint_id || '—'}</td><td>{device.is_active ? <span className="badge bg-success">Active</span> : <span className="badge bg-secondary">Inactive</span>}</td><td>{formatDate(device.last_login_at)}</td><td className="text-end">{device.is_active && <button className="btn btn-sm btn-outline-danger" onClick={()=>handleDeactivate(device.id)} disabled={isLoading}>Deactivate</button>}</td></tr>)}
        </tbody></table></div>}
      </div></div>}
    </div>
  );
};

export default BranchDevices;
