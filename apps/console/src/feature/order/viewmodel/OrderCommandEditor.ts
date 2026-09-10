import { presentError } from '@shop/presentation';
import type { OrderDetail, OrderFulfillment, OrderRecovery, OrderRecoveryAction, OrderSupportCase, OrderSupportState } from '../model/Order';

export interface OrderCommandEditor {
  readonly kind: 'cancel' | 'receive' | 'remind' | 'ship' | 'refund' | 'recovery';
  readonly reason: string;
  readonly confirmed: boolean;
  readonly tracking: string;
  readonly carrier: string;
  readonly amountMinor: string;
  readonly proof: string;
  readonly fulfillment?: OrderFulfillment;
  readonly recovery?: OrderRecovery;
  readonly recoveryAction: OrderRecoveryAction;
}

export function orderSupportState(allowed: boolean, query: Readonly<{ isPending: boolean; isError: boolean; error: unknown; data: readonly OrderSupportCase[] | undefined }>): OrderSupportState {
  if (!allowed) return Object.freeze({ state: 'hidden' });
  if (query.isPending) return Object.freeze({ state: 'loading' });
  if (query.isError) {
    const failure = presentError(query.error);
    return Object.freeze({ state: 'unavailable', error: Object.freeze({ message: failure.message, retryable: failure.retryable, ...(failure.requestId === undefined ? {} : { traceId: failure.requestId }) }) });
  }
  return Object.freeze({ state: 'ready', data: Object.freeze([...(query.data ?? [])]) });
}

export function commandValidation(editor: OrderCommandEditor | undefined, assurance: number, order?: OrderDetail): string | undefined {
  if (!editor) return undefined;
  if (editor.kind === 'cancel' && editor.reason.trim().length < 2) return '请填写取消订单的原因。';
  if (editor.kind === 'receive' && editor.reason.trim().length < 2) return '请填写确认收货的依据。';
  if (editor.kind === 'ship' && editor.tracking.trim().length < 4) return '请填写可核验的物流单号。';
  if (editor.kind === 'refund') {
    const amount = refundMinor(editor.amountMinor);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > (order?.payment.refundableMinor ?? 0)) return '退款金额必须是未退款额度内的整数分值。';
    if (editor.reason.trim().length < 2) return '请填写退款依据。';
  }
  if (editor.kind === 'recovery' && editor.reason.trim().length < 2) return '请填写支付恢复依据。';
  if ((editor.kind === 'refund' || editor.kind === 'recovery') && !/^[A-Za-z0-9_-]{43,128}$/.test(editor.proof)) return '请粘贴另一位复核人签发的一次性操作凭证。';
  if (!editor.confirmed) return confirmationMessage(editor.kind);
  if (editor.kind === 'cancel' && assurance < 2) return '取消订单前请完成二次验证。';
  if (editor.kind === 'receive' && assurance < 2) return '确认收货前请完成二次验证。';
  if (editor.kind === 'ship' && assurance < 2) return '登记发货前请完成二次验证。';
  if ((editor.kind === 'refund' || editor.kind === 'recovery') && assurance < 3) return '提交资金动作前请完成高强度二次验证。';
  return undefined;
}

export function editorDefaults(kind: OrderCommandEditor['kind']): OrderCommandEditor {
  return { kind, reason: '', confirmed: false, tracking: '', carrier: '', amountMinor: '', proof: '', recoveryAction: 'resolve' };
}

export function suggestedRecoveryAction(resourceType: string): OrderCommandEditor['recoveryAction'] {
  if (resourceType === 'intent') return 'requery';
  if (resourceType === 'refund') return 'retryrefund';
  if (resourceType === 'deadletter') return 'replay';
  return 'resolve';
}

export function refundMinor(value: string): number {
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(value.trim())) return Number.NaN;
  const [yuan = '0', fraction = ''] = value.trim().split('.');
  const amount = Number(yuan) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(amount) ? amount : Number.NaN;
}

function confirmationMessage(kind: OrderCommandEditor['kind']): string {
  return (
    {
      cancel: '请确认订单尚未支付、尚未履约，并了解取消后不可恢复。',
      receive: '请确认物流事实和收货状态已核对。',
      remind: '请确认本次催单不会重复打扰履约方。',
      ship: '请确认物流单号、承运方和履约对象均已核对。',
      refund: '请确认退款上限、原因和复核凭证均与当前订单一致。',
      recovery: '请确认恢复方式与错误证据一致，且不会重复执行外部动作。',
    } as const
  )[kind];
}
