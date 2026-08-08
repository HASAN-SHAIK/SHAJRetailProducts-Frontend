import { requestLocalManagerApproval } from '../Repositories/local/posLocalApiClient';

const approvalError = (message) => {
  const error = new Error(message);
  error.code = message;
  return error;
};

const createApprovalDialog = ({ permission }) => {
  if (typeof document === 'undefined' || !document.body) {
    return Promise.reject(approvalError('manager_approval_ui_unavailable'));
  }

  return new Promise((resolve, reject) => {
    const overlay = document.createElement('div');
    overlay.setAttribute('data-pos-manager-approval', 'true');
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      background: 'rgba(0,0,0,0.55)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
    });

    const form = document.createElement('form');
    Object.assign(form.style, {
      width: '100%',
      maxWidth: '420px',
      background: '#fff',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
      fontFamily: 'inherit',
    });

    const title = document.createElement('h3');
    title.textContent = 'Manager approval required';
    title.style.margin = '0 0 8px';

    const help = document.createElement('p');
    help.textContent = permission === 'pos:discount'
      ? 'A manager must approve this discount. The cashier session will remain active.'
      : `A manager must approve ${permission}. The cashier session will remain active.`;
    help.style.margin = '0 0 16px';

    const managerLabel = document.createElement('label');
    managerLabel.textContent = 'Manager user ID';
    const managerInput = document.createElement('input');
    managerInput.name = 'manager_user_id';
    managerInput.required = true;
    managerInput.autocomplete = 'username';
    Object.assign(managerInput.style, { width: '100%', margin: '6px 0 12px', padding: '10px' });

    const pinLabel = document.createElement('label');
    pinLabel.textContent = 'Manager PIN';
    const pinInput = document.createElement('input');
    pinInput.name = 'pin';
    pinInput.type = 'password';
    pinInput.inputMode = 'numeric';
    pinInput.autocomplete = 'off';
    pinInput.required = true;
    pinInput.minLength = 4;
    pinInput.maxLength = 8;
    Object.assign(pinInput.style, { width: '100%', margin: '6px 0 12px', padding: '10px' });

    const reasonLabel = document.createElement('label');
    reasonLabel.textContent = 'Reason (optional)';
    const reasonInput = document.createElement('input');
    reasonInput.name = 'reason';
    reasonInput.maxLength = 240;
    Object.assign(reasonInput.style, { width: '100%', margin: '6px 0 16px', padding: '10px' });

    const errorText = document.createElement('div');
    errorText.setAttribute('role', 'alert');
    Object.assign(errorText.style, { minHeight: '20px', marginBottom: '10px', fontSize: '13px' });

    const actions = document.createElement('div');
    Object.assign(actions.style, { display: 'flex', gap: '8px', justifyContent: 'flex-end' });
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    const approve = document.createElement('button');
    approve.type = 'submit';
    approve.textContent = 'Approve';

    actions.append(cancel, approve);
    form.append(
      title,
      help,
      managerLabel,
      managerInput,
      pinLabel,
      pinInput,
      reasonLabel,
      reasonInput,
      errorText,
      actions
    );
    overlay.append(form);
    document.body.append(overlay);
    managerInput.focus();

    const cleanup = () => overlay.remove();
    cancel.addEventListener('click', () => {
      cleanup();
      reject(approvalError('manager_approval_cancelled'));
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      errorText.textContent = '';
      approve.disabled = true;
      cancel.disabled = true;
      try {
        const result = await requestLocalManagerApproval({
          managerUserId: managerInput.value.trim(),
          pin: pinInput.value,
          permission,
          reason: reasonInput.value.trim(),
        });
        if (!result?.approval_token) throw approvalError('manager_approval_token_missing');
        cleanup();
        resolve(result);
      } catch (error) {
        errorText.textContent =
          error?.payload?.error || error?.message || 'Manager approval failed. Please retry.';
        approve.disabled = false;
        cancel.disabled = false;
        pinInput.value = '';
        pinInput.focus();
      }
    });
  });
};

export const requestManagerApproval = async (permission = 'pos:discount') => {
  if (!permission) throw approvalError('manager_approval_permission_required');
  return createApprovalDialog({ permission });
};
