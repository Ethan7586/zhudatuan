import type { ReferralAction, ReferralActionValues, ReferralSetting } from '../model/Referral';

export interface ReferralDraft {
  readonly reason: string;
  readonly proof: string;
  readonly enabled: boolean;
  readonly recruitEnabled: boolean;
  readonly reviewRequired: boolean;
  readonly rewardEnabled: boolean;
  readonly bindingMode: ReferralSetting['bindingMode'];
  readonly firstTouchDays: number;
  readonly freezeDays: number;
  readonly settlementTrigger: ReferralSetting['settlementTrigger'];
  readonly rateBasisPoints: number;
  readonly rewardBasisPoints: number;
  readonly minimumWithdrawalMinor: number;
  readonly monthlyWithdrawalLimit: number | null;
  readonly currency: string;
  readonly confirmed: boolean;
}

export function emptyReferralDraft(): ReferralDraft {
  return { reason: '', proof: '', enabled: true, recruitEnabled: false, reviewRequired: true, rewardEnabled: false, bindingMode: 'days', firstTouchDays: 7, freezeDays: 7, settlementTrigger: 'received', rateBasisPoints: 0, rewardBasisPoints: 0, minimumWithdrawalMinor: 0, monthlyWithdrawalLimit: null, currency: 'CNY', confirmed: false };
}

export function referralDraftFor(action: ReferralAction): ReferralDraft {
  const setting = action.kind === 'setting' ? action.item : undefined;
  const product = action.kind === 'product' ? action.item : undefined;
  return {
    reason: '',
    proof: '',
    enabled: setting?.enabled ?? product?.enabled ?? true,
    recruitEnabled: setting?.recruitEnabled ?? false,
    reviewRequired: setting?.reviewRequired ?? true,
    rewardEnabled: setting?.rewardEnabled ?? false,
    bindingMode: setting?.bindingMode ?? 'days',
    firstTouchDays: setting?.firstTouchDays ?? 7,
    freezeDays: setting?.freezeDays ?? 7,
    settlementTrigger: setting?.settlementTrigger ?? 'received',
    rateBasisPoints: setting?.rateBasisPoints ?? product?.rateBasisPoints ?? 0,
    rewardBasisPoints: product?.rewardBasisPoints ?? 0,
    minimumWithdrawalMinor: setting?.minimumWithdrawalMinor ?? 0,
    monthlyWithdrawalLimit: setting?.monthlyWithdrawalLimit ?? null,
    currency: setting?.currency ?? 'CNY',
    confirmed: false,
  };
}

export function referralActionValues(action: ReferralAction, draft: ReferralDraft): ReferralActionValues {
  return Object.freeze({
    action,
    reason: draft.reason.trim(),
    enabled: draft.enabled,
    recruitEnabled: draft.recruitEnabled,
    reviewRequired: draft.reviewRequired,
    rewardEnabled: draft.rewardEnabled,
    bindingMode: draft.bindingMode,
    firstTouchDays: draft.firstTouchDays,
    freezeDays: draft.freezeDays,
    settlementTrigger: draft.settlementTrigger,
    rateBasisPoints: draft.rateBasisPoints,
    rewardBasisPoints: draft.rewardBasisPoints,
    minimumWithdrawalMinor: draft.minimumWithdrawalMinor,
    monthlyWithdrawalLimit: draft.monthlyWithdrawalLimit,
    currency: draft.currency,
  });
}

export function validateReferralBody(values: ReferralActionValues): string | undefined {
  if (values.reason.length === 0 || values.reason.length > 500) return '请填写 1 至 500 字的审计原因。';
  if (values.action.kind === 'setting' && (!integerInRange(values.firstTouchDays, 1, 3650) || !integerInRange(values.freezeDays, 0, 3650) || !integerInRange(values.minimumWithdrawalMinor, 0, Number.MAX_SAFE_INTEGER) || (values.monthlyWithdrawalLimit !== null && !integerInRange(values.monthlyWithdrawalLimit, 1, 1000))))
    return '归因天数须为 1 至 3650，冻结天数须为 0 至 3650，最低提现须为非负整数。';
  if ((values.action.kind === 'setting' || values.action.kind === 'product') && !integerInRange(values.rateBasisPoints, 0, 10_000)) return '返佣比例必须是 0 至 10000 的整数基点。';
  if (values.action.kind === 'product' && (!integerInRange(values.rewardBasisPoints, 0, 10_000) || values.rateBasisPoints + values.rewardBasisPoints > 10_000))
    return '返佣与客户奖励必须是非负整数基点，合计不得超过 10000。';
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
