import { isLocalPosEnabled, localPosRequest } from '../../Repositories/local/posLocalApiClient';
import { requestManagerApproval } from '../managerApprovalService';

const normalizeReason = (value) => String(value || '').trim();

const normalizeLines = (lines = []) => {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error('partial_refund_lines_required');

  const seen = new Set();
  return lines.map((line) => {
    const orderItemId = String(line?.orderItemId ?? line?.order_item_id ?? '').trim();
    const quantityMilli = Number(line?.quantityMilli ?? line?.quantity_milli ?? 0);
    if (!orderItemId || !Number.isInteger(quantityMilli) || quantityMilli <= 0) {
      throw new Error('partial_refund_line_invalid');
    }
    if (seen.has(orderItemId)) throw new Error('partial_refund_line_duplicate');
    seen.add(orderItemId);
    return { order_item_id: orderItemId, quantity_milli: quantityMilli };
  });
};

const runLocalPartialRefund = (orderId, options = {}) =>
  localPosRequest(`/orders/${encodeURIComponent(String(orderId))}/refund`, {
    method: 'POST',
    body: {
      reason: normalizeReason(options.reason),
      return_id: String(options.returnId || '').trim(),
      lines: normalizeLines(options.lines),
    },
    approvalToken: options.approvalToken || null,
  });

export const refundOrderPartial = async (orderId, options = {}) => {
  if (!isLocalPosEnabled()) throw new Error('local_pos_refund_not_enabled');
  if (!orderId) throw new Error('order_id_required');
  if (!normalizeReason(options.reason)) throw new Error('refund_reason_required');
  if (!String(options.returnId || '').trim()) throw new Error('partial_refund_return_id_required');
  normalizeLines(options.lines);

  try {
    return await runLocalPartialRefund(orderId, options);
  } catch (error) {
    const code = error?.payload?.error || error?.response?.data?.error || error?.message;
    const requiredPermission =
      error?.payload?.required_permission ||
      error?.response?.data?.required_permission ||
      'pos:refund';

    if (code !== 'manager_approval_required' || options?.approvalToken) {
      throw error;
    }

    const approval = await requestManagerApproval(requiredPermission);
    return runLocalPartialRefund(orderId, {
      ...options,
      approvalToken: approval.approval_token,
    });
  }
};
