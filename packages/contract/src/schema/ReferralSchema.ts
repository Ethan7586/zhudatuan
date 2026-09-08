import { boolean, literal, null as nullSchema, optional, strictObject, string, union } from 'zod/mini';
import { basisPoints, currency, expectedVersion, id, integer, isoUtc, pageOutput, pageQuery, unsigned, version } from './Primitives';

const status = literal(['applied', 'active', 'disqualified']);
const setting = strictObject({
  id: id<'referralsetting'>(),
  scopeId: id<'scope'>(),
  enabled: boolean(),
  recruitEnabled: boolean(),
  reviewRequired: boolean(),
  rewardEnabled: boolean(),
  bindingMode: literal(['permanent', 'days']),
  firstTouchDays: unsigned,
  freezeDays: unsigned,
  settlementTrigger: literal(['paid', 'received']),
  rateBasisPoints: basisPoints,
  minimumWithdrawalMinor: unsigned,
  monthlyWithdrawalLimit: union([unsigned, nullSchema()]),
  currency,
  version,
  updatedAt: isoUtc,
});
const product = strictObject({ id: id<'referralproduct'>(), productId: id<'product'>(), enabled: boolean(), rateBasisPoints: basisPoints, rewardBasisPoints: basisPoints, version, updatedAt: isoUtc });
const member = strictObject({
  id: id<'referralmember'>(),
  memberId: id<'member'>(),
  status,
  appliedAt: isoUtc,
  approvedAt: union([isoUtc, nullSchema()]),
  disqualifiedAt: union([isoUtc, nullSchema()]),
  version,
});
const binding = strictObject({
  id: id<'referralbinding'>(),
  promoterId: id<'referralmember'>(),
  memberId: id<'member'>(),
  source: literal(['storefront', 'miniapp', 'checkout']),
  boundAt: isoUtc,
  expiresAt: union([isoUtc, nullSchema()]),
  status: literal(['active', 'superseded']),
  version,
});
const commissionStatus = literal(['pending', 'available', 'settled', 'reversed']);
const commission = strictObject({
  id: id<'referralcommission'>(),
  orderId: id<'order'>(),
  orderLineId: id<'orderline'>(),
  ruleId: id<'referralproduct'>(),
  ruleVersion: version,
  attributionId: id<'referralbinding'>(),
  promoterId: id<'referralmember'>(),
  kind: literal(['commission', 'reward']),
  status: commissionStatus,
  amountMinor: integer,
  baseMinor: unsigned,
  refundedBaseMinor: unsigned,
  reversedMinor: unsigned,
  rateBasisPoints: basisPoints,
  currency,
  availableAt: union([isoUtc, nullSchema()]),
  settlementJournalId: union([id<'journal'>(), nullSchema()]),
  version,
});
const withdrawalStatus = literal(['requested', 'processing', 'paid', 'failed']);
const withdrawal = strictObject({
  id: id<'referralwithdrawal'>(),
  memberId: id<'referralmember'>(),
  status: withdrawalStatus,
  amountMinor: unsigned,
  currency,
  accountRef: string(),
  approvalId: id<'approvalinstance'>(),
  requestedAt: isoUtc,
  approvedAt: union([isoUtc, nullSchema()]),
  completedAt: union([isoUtc, nullSchema()]),
  providerReference: union([string(), nullSchema()]),
  failureReason: union([string(), nullSchema()]),
  version,
});
const expected = { expectedVersion, reason: string() } as const;
const filter = strictObject({ ...pageQuery, query: optional(string()), status: optional(string()) });

export const REFERRAL_QUERY_SCHEMAS = {
  ReferralSettingsReadInput: strictObject({}),
  ReferralProductsReadInput: filter,
  ReferralMembersReadInput: filter,
  ReferralBindingsReadInput: filter,
  ReferralCommissionsReadInput: filter,
  ReferralEarningsReadInput: strictObject(pageQuery),
  ReferralLinksReadInput: strictObject({ productId: optional(id<'product'>()) }),
  ReferralWithdrawalsReadInput: filter,
} as const;

export const REFERRAL_BODY_SCHEMAS = {
  ReferralSettingsManageInput: strictObject({
    enabled: boolean(),
    recruitEnabled: boolean(),
    reviewRequired: boolean(),
    rewardEnabled: boolean(),
    bindingMode: literal(['permanent', 'days']),
    firstTouchDays: unsigned,
    freezeDays: unsigned,
    settlementTrigger: literal(['paid', 'received']),
    rateBasisPoints: basisPoints,
    minimumWithdrawalMinor: unsigned,
    monthlyWithdrawalLimit: union([unsigned, nullSchema()]),
    currency,
    ...expected,
  }),
  ReferralProductsManageInput: strictObject({ enabled: boolean(), rateBasisPoints: basisPoints, rewardBasisPoints: basisPoints, ...expected }),
  ReferralMembersApplyInput: strictObject({ displayName: string(), mobile: string(), reason: string() }),
  ReferralMembersApproveInput: strictObject(expected),
  ReferralMembersDisqualifyInput: strictObject(expected),
  ReferralBindingsCreateInput: strictObject({ token: string(), source: string() }),
  ReferralWithdrawalsCreateInput: strictObject({ amountMinor: unsigned, currency, accountRef: string(), expectedVersion }),
} as const;

export const REFERRAL_OUTPUT_SCHEMAS = {
  ReferralSettingsReadOutput: setting,
  ReferralSettingsManageOutput: setting,
  ReferralProductsReadOutput: pageOutput(product),
  ReferralProductsManageOutput: product,
  ReferralMembersReadOutput: pageOutput(member),
  ReferralMembersApplyOutput: member,
  ReferralMembersApproveOutput: member,
  ReferralMembersDisqualifyOutput: member,
  ReferralBindingsReadOutput: pageOutput(binding),
  ReferralBindingsCreateOutput: binding,
  ReferralCommissionsReadOutput: pageOutput(commission),
  ReferralEarningsReadOutput: strictObject({ availableMinor: integer, pendingMinor: integer, settledMinor: integer, reversedMinor: integer, currency, version, ...pageOutput(commission).shape }),
  ReferralLinksReadOutput: strictObject({ token: string(), url: string(), expiresAt: isoUtc, productId: union([id<'product'>(), nullSchema()]) }),
  ReferralWithdrawalsReadOutput: pageOutput(withdrawal),
  ReferralWithdrawalsCreateOutput: withdrawal,
} as const;
