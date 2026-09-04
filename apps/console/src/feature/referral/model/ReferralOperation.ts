import type { OperationId } from '@shop/contract';
import {
  OP_REFERRAL_BINDINGS_READ,
  OP_REFERRAL_COMMISSIONS_READ,
  OP_REFERRAL_MEMBERS_APPROVE,
  OP_REFERRAL_MEMBERS_DISQUALIFY,
  OP_REFERRAL_MEMBERS_READ,
  OP_REFERRAL_PRODUCTS_MANAGE,
  OP_REFERRAL_PRODUCTS_READ,
  OP_REFERRAL_SETTINGS_MANAGE,
  OP_REFERRAL_SETTINGS_READ,
  OP_REFERRAL_WITHDRAWALS_READ,
} from '@shop/contract/ids';
import type { ReferralAction, ReferralActionValues, ReferralSection } from './Referral';

export type ReferralCommandOperation = typeof OP_REFERRAL_SETTINGS_MANAGE | typeof OP_REFERRAL_PRODUCTS_MANAGE | typeof OP_REFERRAL_MEMBERS_APPROVE | typeof OP_REFERRAL_MEMBERS_DISQUALIFY;

export interface ReferralCommand {
  readonly operation: ReferralCommandOperation;
  readonly expectedVersion: number;
  readonly input: Readonly<{ path: Readonly<Record<string, string>>; body: Readonly<Record<string, unknown>> }>;
}

export const referralReadOperations = Object.freeze({
  settings: OP_REFERRAL_SETTINGS_READ,
  product: OP_REFERRAL_PRODUCTS_READ,
  review: OP_REFERRAL_MEMBERS_READ,
  binding: OP_REFERRAL_BINDINGS_READ,
  withdrawal: OP_REFERRAL_WITHDRAWALS_READ,
  promotion: OP_REFERRAL_COMMISSIONS_READ,
} satisfies Readonly<Record<ReferralSection, OperationId>>);

export const referralWriteOperations = Object.freeze({
  setting: OP_REFERRAL_SETTINGS_MANAGE,
  product: OP_REFERRAL_PRODUCTS_MANAGE,
  approve: OP_REFERRAL_MEMBERS_APPROVE,
  disqualify: OP_REFERRAL_MEMBERS_DISQUALIFY,
} satisfies Readonly<Record<ReferralAction['kind'], ReferralCommandOperation>>);

export function createReferralCommand(values: ReferralActionValues): ReferralCommand {
  const { action, reason } = values;
  if (action.kind === 'approve' || action.kind === 'disqualify') {
    return Object.freeze({
      operation: referralWriteOperations[action.kind],
      expectedVersion: action.item.version,
      input: Object.freeze({ path: Object.freeze({ memberid: action.item.id }), body: Object.freeze({ reason, expectedVersion: action.item.version }) }),
    });
  }
  if (action.kind === 'product') {
    return Object.freeze({
      operation: referralWriteOperations.product,
      expectedVersion: action.item.version,
      input: Object.freeze({ path: Object.freeze({ productid: action.item.productId }), body: Object.freeze({ enabled: values.enabled, rateBasisPoints: values.rateBasisPoints, rewardBasisPoints: values.rewardBasisPoints, expectedVersion: action.item.version, reason }) }),
    });
  }
  return Object.freeze({
    operation: referralWriteOperations.setting,
    expectedVersion: action.item.version,
    input: Object.freeze({
      path: Object.freeze({ settingid: action.item.id }),
      body: Object.freeze({
        enabled: values.enabled,
        recruitEnabled: values.recruitEnabled,
        reviewRequired: values.reviewRequired,
        rewardEnabled: values.rewardEnabled,
        bindingMode: values.bindingMode,
        firstTouchDays: values.firstTouchDays,
        freezeDays: values.freezeDays,
        settlementTrigger: values.settlementTrigger,
        rateBasisPoints: values.rateBasisPoints,
        minimumWithdrawalMinor: values.minimumWithdrawalMinor,
        monthlyWithdrawalLimit: values.monthlyWithdrawalLimit,
        currency: values.currency,
        expectedVersion: action.item.version,
        reason,
      }),
    }),
  });
}
