const DEFAULT_BASE_URL = 'http://127.0.0.1:4782/api/v1';
const POS_SESSION_KEY = 'pos_local_session_token';
const POS_USER_KEY = 'pos_local_user_id';

const DEV_POS_PROFILES = Object.freeze({
  3001: { id:'pos1', label:'POS1', baseUrl:'http://127.0.0.1:4781/api/v1', deviceId:'SIM-POS-DTN-01', storeId:'11111111-1111-4111-8111-111111111111', storeNumber:'STORE-001', posNo:'POS-01', touchpointId:'TP-01', storeName:'Downtown Hub' },
  3002: { id:'pos2', label:'POS2', baseUrl:'http://127.0.0.1:4782/api/v1', deviceId:'SIM-POS-DTN-02', storeId:'11111111-1111-4111-8111-111111111111', storeNumber:'STORE-001', posNo:'POS-02', touchpointId:'TP-02', storeName:'Downtown Hub' },
  3003: { id:'pos3', label:'POS3', baseUrl:'http://127.0.0.1:4783/api/v1', deviceId:'SIM-POS-WE-01', storeId:'22222222-2222-4222-8222-222222222222', storeNumber:'STORE-002', posNo:'POS-01', touchpointId:'TP-01', storeName:'West End' },
});

const isDevelopmentRuntime = () => process.env.NODE_ENV !== 'production';
let developmentProfilePortOverride = null;
const isLoopbackHost = (hostname) => ['localhost','127.0.0.1','[::1]','::1'].includes(String(hostname || '').toLowerCase());

export const getDevelopmentPosProfile = () => {
  if (!isDevelopmentRuntime() || typeof window === 'undefined') return null;
  if (developmentProfilePortOverride) return DEV_POS_PROFILES[Number(developmentProfilePortOverride)] || null;
  if (!isLoopbackHost(window.location.hostname)) return null;
  return DEV_POS_PROFILES[Number(window.location.port)] || null;
};
export const __setDevelopmentPosProfilePortForTests = (port) => { if (process.env.NODE_ENV === 'test') developmentProfilePortOverride = port ? Number(port) : null; };
const scopedKey = (key) => { const profile=getDevelopmentPosProfile(); return profile?.id ? `${key}:${profile.id}` : key; };
export const isLocalPosEnabled = () => String(process.env.REACT_APP_POS_LOCAL_API_ENABLED || 'false').toLowerCase() === 'true';
const getBaseUrl = () => String(getDevelopmentPosProfile()?.baseUrl || process.env.REACT_APP_POS_LOCAL_API_URL || DEFAULT_BASE_URL).replace(/\/$/, '');

if (isLocalPosEnabled()) { try { const url=new URL(getBaseUrl()); if(!['http:','https:'].includes(url.protocol)) throw new Error('unsupported protocol'); } catch { console.warn('[config] REACT_APP_POS_LOCAL_API_URL must be a valid HTTP(S) URL.'); } }

const getRuntimeToken = async () => {
  if (typeof window !== 'undefined') {
    const bridge=window.shajPosBridge;
    if (bridge && typeof bridge.getLocalApiToken === 'function') { const token=await bridge.getLocalApiToken(); if(token) return String(token); }
    if (window.__SHAJ_POS_LOCAL_API_TOKEN__) return String(window.__SHAJ_POS_LOCAL_API_TOKEN__);
  }
  if (process.env.NODE_ENV !== 'production' && process.env.REACT_APP_POS_LOCAL_API_TOKEN) return process.env.REACT_APP_POS_LOCAL_API_TOKEN;
  throw new Error('local_pos_token_unavailable');
};
const getLocalSessionToken = () => { if(typeof window==='undefined')return null; try{return window.sessionStorage.getItem(scopedKey(POS_SESSION_KEY));}catch{return null;} };
const setLocalSession = (token,userId) => { if(typeof window==='undefined')return; window.sessionStorage.setItem(scopedKey(POS_SESSION_KEY),token); if(userId)window.localStorage.setItem(scopedKey(POS_USER_KEY),String(userId)); };
export const clearLocalPosSession = () => { if(typeof window==='undefined')return; try{window.sessionStorage.removeItem(scopedKey(POS_SESSION_KEY));}catch{} };
export const getCachedLocalPosUserId = () => { if(typeof window==='undefined')return null; try{return window.localStorage.getItem(scopedKey(POS_USER_KEY));}catch{return null;} };

const request = async (path,{method='GET',body,signal,requireSession=true,approvalToken=null}={}) => {
  const machineToken=await getRuntimeToken(); const sessionToken=requireSession?getLocalSessionToken():null;
  if(requireSession&&!sessionToken)throw new Error('local_pos_session_unavailable');
  const response=await fetch(`${getBaseUrl()}${path}`,{method,signal,headers:{Accept:'application/json','Content-Type':'application/json','X-POS-Local-Token':machineToken,...(sessionToken?{'X-POS-Session-Token':sessionToken}:{}),...(approvalToken?{'X-POS-Approval-Token':String(approvalToken)}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(response.status===204)return null; const payload=await response.json().catch(()=>null);
  if(!response.ok){const error=new Error(payload?.error||`local_pos_http_${response.status}`);error.status=response.status;error.payload=payload;throw error;} return payload;
};

export const enrollLocalPosUser = async ({offlineGrant,pin}) => request('/auth/enroll',{method:'POST',requireSession:false,body:{offline_grant:offlineGrant,pin}});

const assertDevelopmentProfileMatchesDevice = (device) => {
  const profile=getDevelopmentPosProfile(); if(!profile||!device)return;
  const mismatches=[['device_id',device.device_id,profile.deviceId],['store_id',device.store_id,profile.storeId],['store_number',device.store_number,profile.storeNumber],['pos_no',device.pos_no||device.terminal_id,profile.posNo],['touchpoint_id',device.touchpoint_id,profile.touchpointId]].filter(([,actual,expected])=>String(actual||'')!==String(expected||''));
  if(!mismatches.length)return; const error=new Error(`dev_pos_profile_mismatch:${profile.label}`); error.code='DEV_POS_PROFILE_MISMATCH'; error.profile=profile; error.mismatches=mismatches.map(([field,actual,expected])=>({field,actual,expected})); throw error;
};

export const getLocalPosDevice = async () => { const device=await request('/device',{method:'GET',requireSession:false}); assertDevelopmentProfileMatchesDevice(device); return device; };
export const registerLocalPosDevice = async ({storeId,storeNumber,posNo,touchpointId}) => request('/device/registration',{method:'PUT',requireSession:false,body:{store_id:String(storeId),store_number:String(storeNumber||'').trim().toUpperCase(),pos_no:String(posNo||'').trim().toUpperCase(),touchpoint_id:String(touchpointId||'').trim().toUpperCase(),terminal_id:String(posNo||'').trim().toUpperCase()}});
export const claimLocalPosSetupCode = async ({setupCode}) => request('/device/setup-code',{method:'POST',requireSession:false,body:{setup_code:String(setupCode||'').trim()}});
export const loginLocalPosUser = async ({userId,pin}) => { const payload=await request('/auth/login',{method:'POST',requireSession:false,body:{user_id:String(userId),pin}}); if(!payload?.session_token)throw new Error('local_pos_session_missing'); setLocalSession(payload.session_token,payload?.user?.user_id||userId); return payload; };
export const validateLocalPosSession = async () => request('/diagnostics',{method:'GET',requireSession:true});
export const logoutLocalPosUser = async () => { try{await request('/auth/logout',{method:'POST'});}finally{clearLocalPosSession();} };
export const requestLocalManagerApproval = async ({managerUserId,pin,permission,reason='',orderId='',actionScope=''}) => { const normalizedOrderId=String(orderId||'').trim(),normalizedActionScope=String(actionScope||'').trim(); const payload=await request('/auth/approvals',{method:'POST',body:{manager_user_id:String(managerUserId),pin:String(pin),permission:String(permission),reason:String(reason||''),...(normalizedOrderId?{order_id:normalizedOrderId}:{}),...(normalizedActionScope?{action_scope:normalizedActionScope}:{})}}); if(!payload?.approval_token)throw new Error('local_pos_approval_missing'); return payload; };
export const localPosRequest = async (path,options={}) => request(path,options);
export const localPosHealth = async () => { const response=await fetch(`${getBaseUrl()}/health`,{method:'GET'}); if(!response.ok)throw new Error(`local_pos_health_${response.status}`); return response.json(); };
