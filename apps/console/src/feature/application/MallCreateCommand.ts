import { ApiError } from '@shop/sdk';
import { createIdempotencyKey } from '@shop/sdk/context';
import { createFetchIdentityStepupComplete, createFetchIdentityStepupStart } from '@shop/sdk/identity';
import { createFetchProvisioningMallsCreate } from '@shop/sdk/provisioning';
import { z } from 'zod';
import type { ConsoleContext, ConsoleScope } from '../../entity/session/ConsoleSession';
import { consoleCommand } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';

const mallsCreate = createFetchProvisioningMallsCreate(appConfig.apiBaseUrl);
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
