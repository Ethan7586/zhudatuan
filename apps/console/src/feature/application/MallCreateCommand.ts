import { ApiError } from '@shop/sdk';
import { createIdempotencyKey } from '@shop/sdk/context';
import {
  createFetchIdentityMobileChallenge,
  createFetchIdentityMobileManage,
  createFetchIdentityPasswordVerify,
  createFetchIdentityStepupComplete,
  createFetchIdentityStepupStart,
} from '@shop/sdk/identity';
import { createFetchProvisioningMallsCreate } from '@shop/sdk/provisioning';
import { z } from 'zod';
import type { ConsoleContext, ConsoleScope } from '../../entity/session/ConsoleSession';
import { consoleCommand } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';

const mallsCreate = createFetchProvisioningMallsCreate(appConfig.apiBaseUrl);
const passwordVerify = createFetchIdentityPasswordVerify(appConfig.apiBaseUrl);
const mobileChallenge = createFetchIdentityMobileChallenge(appConfig.apiBaseUrl);
const mobileManage = createFetchIdentityMobileManage(appConfig.apiBaseUrl);
const stepupStart = createFetchIdentityStepupStart(appConfig.apiBaseUrl);
const stepupComplete = createFetchIdentityStepupComplete(appConfig.apiBaseUrl);

const CreatedMallSchema = z.object({
  mallId: z.string().min(1),
  enterpriseId: z.string().min(1),
  applicationId: z.string().min(1),
  poolId: z.string().min(1),
  code: z.string().min(1),
  publicSlug: z.string().min(1),
  name: z.string().min(1),
  state: z.literal('ready'),
  publicationState: z.literal('draft'),
});

const StepupChallengeSchema = z.object({
  id: z.string().min(1),
  purpose: z.literal('stepup'),
  expires_at: z.string().min(1),
});

const StepupCompleteSchema = z.object({
  id: z.string().min(1),
  assurance_level: z.number().int().min(3),
});

const PasswordVerificationSchema = z.object({
  verified: z.literal(true),
  verifiedAt: z.string().min(1),
});

const MobileChallengeSchema = z.object({
  id: z.string().min(1),
  purpose: z.literal('phone_change'),
  expires_at: z.string().min(1),
});

const MobileReceiptSchema = z.object({
  id: z.string().min(1),
});

export interface MallCreateDraft {
  readonly enterpriseId: string;
  readonly name: string;
  readonly code: string;
  readonly publicSlug: string;
}

export interface MallCreateAttempt extends MallCreateDraft {
  readonly idempotencyKey: string;
}

export type CreatedMall = z.infer<typeof CreatedMallSchema>;
export type MallStepupChallenge = z.infer<typeof StepupChallengeSchema>;
export type MallMobileChallenge = z.infer<typeof MobileChallengeSchema>;

export function mallProvisioningScope(context: ConsoleContext): ConsoleScope | undefined {
  if (context.scope.kind === 'platform') return context.scope;
  return context.scopes.find((scope) => scope.kind === 'platform');
}

export function mallEnterpriseScopes(context: ConsoleContext): readonly ConsoleScope[] {
  const values = context.scope.kind === 'enterprise' ? [context.scope, ...context.scopes] : context.scopes;
  const unique = [...new Map(values.filter((scope) => scope.kind === 'enterprise').map((scope) => [scope.id, scope])).values()];
  return Object.freeze(unique.sort((left, right) => (left.name ?? left.id).localeCompare(right.name ?? right.id)));
}

export function canCreateMall(context: ConsoleContext, platformScope: ConsoleScope | undefined): boolean {
  return platformScope !== undefined
    && context.session.csrf !== undefined
    && context.session.permissions.includes('organization.layer.manage')
    && context.session.capabilities.includes('provisioning.malls.create');
}

export function mallCreationRequiresStepup(context: ConsoleContext): boolean {
  return context.session.assurance.level < 3 || context.session.assurance.verified === undefined;
}

export function mallMobileEnrollmentRequired(context: ConsoleContext): boolean {
  if (context.session.security !== undefined) return context.session.security.phoneMasked === null;
  return context.profile.mobile_bound === false;
}

export function newMallCreateAttempt(draft: MallCreateDraft): MallCreateAttempt {
  return Object.freeze({
    enterpriseId: draft.enterpriseId.trim(),
    name: draft.name.trim(),
    code: draft.code.trim(),
    publicSlug: draft.publicSlug.trim(),
    idempotencyKey: createIdempotencyKey(),
  });
}

export async function startMallCreateStepup(
  context: ConsoleContext,
  platformScope: ConsoleScope,
  signal?: AbortSignal,
): Promise<MallStepupChallenge> {
  const value = await stepupStart({ body: {} }, consoleCommand(platformScope, {
    accessVersion: context.session.accessVersion,
    ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
    ...(signal === undefined ? {} : { signal }),
  }));
  return StepupChallengeSchema.parse(value);
}

export async function verifyMallEnrollmentPassword(
  context: ConsoleContext,
  password: string,
  signal?: AbortSignal,
): Promise<void> {
  const value = await passwordVerify({ body: { password } }, identityCommand(context, signal));
  PasswordVerificationSchema.parse(value);
}

export async function requestMallEnrollmentCode(
  context: ConsoleContext,
  mainlandMobile: string,
  signal?: AbortSignal,
): Promise<MallMobileChallenge> {
  const value = await mobileChallenge(
    { body: { destination: canonicalMainlandMobile(mainlandMobile) } },
    identityCommand(context, signal),
  );
  return MobileChallengeSchema.parse(value);
}

export async function bindMallEnrollmentMobile(
  context: ConsoleContext,
  mainlandMobile: string,
  challenge: string,
  code: string,
  signal?: AbortSignal,
): Promise<void> {
  const value = await mobileManage({ body: {
    mobile: canonicalMainlandMobile(mainlandMobile),
    challenge,
    code: code.trim(),
  } }, identityCommand(context, signal));
  MobileReceiptSchema.parse(value);
}

export async function completeMallCreateStepup(
  context: ConsoleContext,
  platformScope: ConsoleScope,
  challenge: string,
  code: string,
  signal?: AbortSignal,
): Promise<void> {
  const value = await stepupComplete({ body: { challenge, code: code.trim() } }, consoleCommand(platformScope, {
    accessVersion: context.session.accessVersion,
    ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
    ...(signal === undefined ? {} : { signal }),
  }));
  StepupCompleteSchema.parse(value);
}

export async function createMall(
  context: ConsoleContext,
  platformScope: ConsoleScope,
  attempt: MallCreateAttempt,
  signal?: AbortSignal,
): Promise<CreatedMall> {
  const value = await mallsCreate({ body: {
    enterpriseId: attempt.enterpriseId,
    name: attempt.name,
    code: attempt.code,
    publicSlug: attempt.publicSlug,
  } }, consoleCommand(platformScope, {
    accessVersion: context.session.accessVersion,
    ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
    idempotencyKey: attempt.idempotencyKey,
    ...(signal === undefined ? {} : { signal }),
  }));
  return CreatedMallSchema.parse(value);
}

export function isMallStepupRequired(error: unknown): boolean {
  return apiErrorCode(error) === 'STEPUP_REQUIRED';
}

export function isMallMobileMissing(error: unknown): boolean {
  return apiErrorCode(error) === 'STEP_UP_DESTINATION_MISSING';
}

export function mallEnrollmentError(error: unknown): string {
  const code = apiErrorCode(error) ?? (error instanceof Error ? error.message : undefined);
  if (code === 'CREDENTIAL_INVALID') return '当前密码不正确，请重新输入。';
  if (code === 'IDENTITY_SUBJECT_EXISTS') return '该手机号已经绑定其他账号。';
  if (code === 'CHALLENGE_INVALID' || code === 'CHALLENGE_CODE_INVALID') return '验证码不正确，请重新获取。';
  if (code === 'CHALLENGE_EXPIRED') return '验证码已过期，请重新获取。';
  if (code === 'MOBILE_ENROLLMENT_PASSWORD_REQUIRED') return '密码验证已失效，请重新开始绑定。';
  if (error instanceof ApiError) return `${error.code} · 请求 ${error.requestId}`;
  return error instanceof Error ? error.message : '手机号绑定失败，请稍后重试。';
}

export function mallCreationError(error: unknown): string {
  const code = apiErrorCode(error) ?? (error instanceof Error ? error.message : undefined);
  if (code === 'MALL_CODE_CONFLICT') return '商城代码已被当前集团使用，请更换后重试。';
  if (code === 'MALL_PUBLIC_SLUG_CONFLICT') return '访问标识已被使用，请更换后重试。';
  if (code === 'MALL_PARENT_INVALID') return '所属集团已失效或不在平台管理范围内。';
  if (code === 'STEPUP_REQUIRED') return '本次创建需要重新完成手机验证。';
  if (code === 'MALL_CREATE_NOT_AVAILABLE') return '当前账号没有商城创建能力，请切换到平台控制范围。';
  if (error instanceof ApiError) return `创建失败：${error.code} · 请求 ${error.requestId}`;
  return error instanceof Error ? `创建失败：${error.message}` : '创建失败，请稍后重试。';
}

function apiErrorCode(error: unknown): string | undefined {
  if (error instanceof ApiError) return error.code;
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
}

function identityCommand(context: ConsoleContext, signal?: AbortSignal) {
  return consoleCommand(undefined, {
    accessVersion: context.session.accessVersion,
    ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
    ...(signal === undefined ? {} : { signal }),
  });
}

function canonicalMainlandMobile(value: string): string {
  if (!/^1[3-9][0-9]{9}$/.test(value)) throw new Error('请输入有效的中国大陆手机号。');
  return `+86${value}`;
}
