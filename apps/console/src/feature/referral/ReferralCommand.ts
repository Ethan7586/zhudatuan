import { createFetchReferralMembersApprove, createFetchReferralMembersDisqualify, createFetchReferralProductsManage, createFetchReferralSettingsManage } from '@shop/sdk/referral';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleCommand } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import type { ReferralAction } from './ReferralSchema';
import type { OperationId } from '@shop/contract';

const settingsManage = createFetchReferralSettingsManage(appConfig.apiBaseUrl);
const productsManage = createFetchReferralProductsManage(appConfig.apiBaseUrl);
const membersApprove = createFetchReferralMembersApprove(appConfig.apiBaseUrl);
const membersDisqualify = createFetchReferralMembersDisqualify(appConfig.apiBaseUrl);

export interface ReferralActionInput {
  readonly action: ReferralAction;
  readonly reason: string;
  readonly proof: string;
  readonly enabled?: boolean;
  readonly firstTouchDays?: number;
  readonly rateBasisPoints?: number;
  readonly minimumWithdrawalMinor?: number;
  readonly currency?: string;
}

export interface ReferralActionEnvelope {
  readonly operation: OperationId;
  readonly input: Readonly<{ path: Readonly<Record<string, string>>; body: Readonly<Record<string, unknown>> }>;
}

export async function executeReferralAction(context: ConsoleContext, input: ReferralActionInput, signal?: AbortSignal): Promise<unknown> {
  if (context.session.assurance.level < 3) throw new Error('STEPUP_REQUIRED');
  if (context.session.csrf === undefined) throw new Error('CSRF_TOKEN_INVALID');
  const request = consoleCommand(context.scope, {
    accessVersion: context.session.accessVersion,
    expectedVersion: input.action.version,
    proof: input.proof,
    csrfToken: context.session.csrf,
    ...(signal === undefined ? {} : { signal }),
  });
  const envelope = referralActionEnvelope(input);
  if (input.action.kind === 'approve' || input.action.kind === 'disqualify') {
    const operation = input.action.kind === 'approve' ? membersApprove : membersDisqualify;
    return operation(envelope.input as Parameters<typeof operation>[0], request);
  }
  if (input.action.kind === 'product') {
    return productsManage(envelope.input as Parameters<typeof productsManage>[0], request);
  }
  return settingsManage(envelope.input as Parameters<typeof settingsManage>[0], request);
}

export function referralActionEnvelope(input: Omit<ReferralActionInput, 'proof'>): ReferralActionEnvelope {
  const action = input.action;
  if (action.kind === 'approve' || action.kind === 'disqualify') {
    return Object.freeze({
      operation: `referral.members.${action.kind}` as OperationId,
      input: Object.freeze({ path: Object.freeze({ memberid: action.id }), body: Object.freeze({ reason: input.reason, expectedVersion: action.version }) }),
    });
  }
  if (action.kind === 'product') {
    return Object.freeze({
      operation: `referral.products.manage`,
      input: Object.freeze({
        path: Object.freeze({ productid: action.id }),
        body: Object.freeze({ enabled: required(input.enabled), rateBasisPoints: required(input.rateBasisPoints), expectedVersion: action.version, reason: input.reason }),
      }),
    });
  }
  return Object.freeze({
    operation: `referral.settings.manage`,
    input: Object.freeze({
      path: Object.freeze({ settingid: action.id }),
      body: Object.freeze({
        enabled: required(input.enabled),
        firstTouchDays: required(input.firstTouchDays),
        rateBasisPoints: required(input.rateBasisPoints),
        minimumWithdrawalMinor: required(input.minimumWithdrawalMinor),
        currency: input.currency ?? 'CNY',
        expectedVersion: action.version,
        reason: input.reason,
      }),
    }),
  });
}

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('REFERRAL_ACTION_FIELD_REQUIRED');
  return value;
}
