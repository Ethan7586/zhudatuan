import type { ReferralAction, ReferralActionValues } from '../model/Referral';

export interface ReferralDraft {
  readonly reason: string;
  readonly proof: string;
  readonly enabled: boolean;
  readonly firstTouchDays: number;
  readonly rateBasisPoints: number;
  readonly minimumWithdrawalMinor: number;
  readonly currency: string;
  readonly confirmed: boolean;
}

export function emptyReferralDraft(): ReferralDraft {
  return { reason: '', proof: '', enabled: true, firstTouchDays: 7, rateBasisPoints: 0, minimumWithdrawalMinor: 0, currency: 'CNY', confirmed: false };
}

export function referralDraftFor(action: ReferralAction): ReferralDraft {
  const setting = action.kind === 'setting' ? action.item : undefined;
  const product = action.kind === 'product' ? action.item : undefined;
  return {
    reason: '',
    proof: '',
    enabled: setting?.enabled ?? product?.enabled ?? true,
    firstTouchDays: setting?.firstTouchDays ?? 7,
    rateBasisPoints: setting?.rateBasisPoints ?? product?.rateBasisPoints ?? 0,
    minimumWithdrawalMinor: setting?.minimumWithdrawalMinor ?? 0,
    currency: setting?.currency ?? 'CNY',
    confirmed: false,
  };
}

export function referralActionValues(action: ReferralAction, draft: ReferralDraft): ReferralActionValues {
  return Object.freeze({
    action,
    reason: draft.reason.trim(),
    enabled: draft.enabled,
    firstTouchDays: draft.firstTouchDays,
    rateBasisPoints: draft.rateBasisPoints,
    minimumWithdrawalMinor: draft.minimumWithdrawalMinor,
    currency: draft.currency,
  });
}

export function validateReferralBody(values: ReferralActionValues): string | undefined {
  if (values.reason.length === 0 || values.reason.length > 500) return '请填写 1 至 500 字的审计原因。';
  if (values.action.kind === 'setting' && (!integerInRange(values.firstTouchDays, 0, Number.MAX_SAFE_INTEGER) || !integerInRange(values.minimumWithdrawalMinor, 0, Number.MAX_SAFE_INTEGER))) return '归因天数和最低提现必须是非负整数。';
  if ((values.action.kind === 'setting' || values.action.kind === 'product') && !integerInRange(values.rateBasisPoints, 0, 10_000)) return '返佣比例必须是 0 至 10000 的整数基点。';
  return undefined;
}

export function validateReferralAction(action: ReferralAction | undefined, draft: ReferralDraft, assurance: number): string | undefined {
  if (action === undefined) return undefined;
  const bodyError = validateReferralBody(referralActionValues(action, draft));
  if (bodyError) return bodyError;
  if (!draft.confirmed) return '请确认目标、版本与修改内容。';
  if (assurance < 3) return '请先完成高强度二次验证。';
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(draft.proof)) return '请输入另一位复核人签发的一次性操作凭证。';
  return undefined;
}

export function referralActionReference(action: ReferralAction): string {
  return action.kind === 'product' ? action.item.productId : action.item.id;
}

export function referralActionMessage(action: ReferralAction): string {
  if (action.kind === 'setting') return '分销设定已更新并完成权威回读。';
  if (action.kind === 'product') return '商品返佣策略已更新并完成权威回读。';
  return action.kind === 'approve' ? '推广会员申请已通过并完成权威回读。' : '推广资格已取消并完成权威回读。';
}

function integerInRange(value: number, minimum: number, maximum: number): boolean {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}
