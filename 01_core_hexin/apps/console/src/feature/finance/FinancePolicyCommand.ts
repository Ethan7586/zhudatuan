import { ContractJsonValueSchema, canonicalFinancialActionRequest, type ContractJsonObject } from '@shop/contract';
import { createIdempotencyKey, createRequestContext } from '@shop/sdk/context';
import { createFetchFinancePoliciesManage, createFetchFinancePoliciesPreview } from '@shop/sdk/finance';
import { createFetchIdentityStepupComplete, createFetchIdentityStepupStart } from '@shop/sdk/identity';
import { z } from 'zod';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleCommand } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { FinanceFieldDefinitionSchema, FinanceTaxRuleSchema, type FinanceConfigPolicy } from './FinancePolicyEditorSchema';

const policiesPreview = createFetchFinancePoliciesPreview(appConfig.apiBaseUrl);
const policiesManage = createFetchFinancePoliciesManage(appConfig.apiBaseUrl);
const stepupStart = createFetchIdentityStepupStart(appConfig.apiBaseUrl);
const stepupComplete = createFetchIdentityStepupComplete(appConfig.apiBaseUrl);

const HashSchema = z.string().regex(/^[0-9a-f]{64}$/);
const PolicyActionSchema = z.enum(['saveDraft', 'submit', 'approve', 'reject']);
const PolicyKindSchema = z.enum(['tax', 'field-definition']);
const DesiredStateSchema = z.enum(['active', 'retired']);
const WirePolicyStateSchema = z.enum(['draft', 'submitted', 'active', 'rejected', 'retired']);
const OptionalTextSchema = z.string().min(1).nullable();

const PolicyPreviewReceiptSchema = z.object({
  preview: z.object({
    id: z.string().min(1),
    policyId: z.string().min(1),
    scopeId: z.string().min(1),
    action: PolicyActionSchema,
    kind: PolicyKindSchema,
    rule: z.record(z.string(), z.unknown()),
    desiredState: DesiredStateSchema,
    effectiveFrom: z.string().min(1),
    effectiveTo: OptionalTextSchema,
    sourceVersion: z
      .number()
      .int()
      .nonnegative()
      .or(
        z
          .string()
          .regex(/^(?:0|[1-9][0-9]*)$/)
          .transform(Number)
      ),
    sourceHash: HashSchema,
    previewHash: HashSchema,
    expiresAt: z.string().min(1),
    proposedBy: z.string().min(1),
  }),
});

const PolicyManageReceiptSchema = z.object({
  policy: z.object({
    id: z.string().min(1),
    scopeId: z.string().min(1),
    kind: PolicyKindSchema,
    rule: z.record(z.string(), z.unknown()),
    state: WirePolicyStateSchema,
    desiredState: DesiredStateSchema,
    version: z
      .number()
      .int()
      .nonnegative()
      .or(
        z
          .string()
          .regex(/^(?:0|[1-9][0-9]*)$/)
          .transform(Number)
      ),
    effectiveFrom: z.string().min(1),
    effectiveTo: OptionalTextSchema,
    sourceHash: HashSchema,
    revisionHash: HashSchema,
    previewHash: HashSchema,
    proposedBy: z.string().min(1),
    submittedBy: OptionalTextSchema,
    approvedBy: OptionalTextSchema,
    rejectedBy: OptionalTextSchema,
    actedBy: z.string().min(1),
    reason: z.string().min(1),
    evidence: z.record(z.string(), z.unknown()),
    createdAt: z.string().min(1),
    submittedAt: OptionalTextSchema,
    decidedAt: OptionalTextSchema,
  }),
});

const StepupChallengeSchema = z.object({
  id: z.string().min(1),
  purpose: z.literal('stepup'),
  expires_at: z.string().min(1),
});

const ActionProofReceiptSchema = z.object({
  id: z.string().min(1),
  assurance_level: z.number().int().min(3),
  actionProof: z.object({
    proof: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
    operation: z.literal('finance.policies.manage'),
    resource: z.string().min(1),
    scope: z.string().min(1),
    idempotencyKey: z.string().min(1),
    expectedVersion: z.number().int().nonnegative(),
    requestHash: HashSchema,
    expiresAt: z.string().min(1),
  }),
});

export type FinancePolicyAction = z.infer<typeof PolicyActionSchema>;
export type FinancePolicyDesiredState = z.infer<typeof DesiredStateSchema>;
export type FinancePolicyPreviewReceipt = z.infer<typeof PolicyPreviewReceiptSchema>;
export type FinancePolicyManageReceipt = z.infer<typeof PolicyManageReceiptSchema>;
export type FinancePolicyStepupChallenge = z.infer<typeof StepupChallengeSchema>;

export interface FinancePolicyIntent {
  readonly policy: FinanceConfigPolicy;
  readonly action: FinancePolicyAction;
  readonly desiredState: FinancePolicyDesiredState;
  readonly reason: string;
  readonly evidence: ContractJsonObject;
}

export interface PreparedFinancePolicyChange {
  readonly intent: FinancePolicyIntent;
  readonly preview: FinancePolicyPreviewReceipt['preview'];
  readonly idempotencyKey: string;
  readonly requestHash: string;
  readonly path: Readonly<{ policyid: string }>;
  readonly body: Readonly<{
    action: FinancePolicyAction;
    previewHash: string;
    reason: string;
    evidence: ContractJsonObject;
  }>;
}

export function financePolicyWritesAvailable(context: ConsoleContext): boolean {
  return (
    context.session.csrf !== undefined &&
    context.session.permissions.includes('finance.policy.manage') &&
    context.session.capabilities.includes('identity.stepup.start') &&
    context.session.capabilities.includes('identity.stepup.complete') &&
    context.session.capabilities.includes('finance.policies.preview') &&
    context.session.capabilities.includes('finance.policies.manage')
  );
}

export async function previewFinancePolicyChange(context: ConsoleContext, intent: FinancePolicyIntent, signal?: AbortSignal): Promise<PreparedFinancePolicyChange> {
  assertPolicyCommandAvailable(context);
  const rule = parseIntentRule(intent.policy);
  const previewBody = Object.freeze({
    action: intent.action,
    kind: intent.policy.kind,
    rule,
    desiredState: intent.desiredState,
  });
  const value = await policiesPreview(
    { path: { policyid: intent.policy.id }, body: previewBody },
    consoleCommand(context.scope, {
      accessVersion: context.session.accessVersion,
      expectedVersion: intent.policy.version,
      csrfToken: context.session.csrf!,
      ...(signal === undefined ? {} : { signal }),
    })
  );
  const receipt = PolicyPreviewReceiptSchema.parse(value);
  assertPreviewBinding(context, intent, receipt.preview, rule);
  const path = Object.freeze({ policyid: intent.policy.id });
  const body = Object.freeze({
    action: intent.action,
    previewHash: receipt.preview.previewHash,
    reason: requiredReason(intent.reason),
    evidence: contractJsonObject(intent.evidence),
  });
  const idempotencyKey = createIdempotencyKey();
  const requestHash = await sha256(canonicalFinancialActionRequest({ operation: 'finance.policies.manage', path, query: {}, body }));
  return Object.freeze({ intent, preview: receipt.preview, idempotencyKey, requestHash, path, body });
}

export async function startFinancePolicyStepup(context: ConsoleContext, signal?: AbortSignal): Promise<FinancePolicyStepupChallenge> {
  assertPolicyCommandAvailable(context);
  const value = await stepupStart(
    { body: {} },
    consoleCommand(context.scope, {
      accessVersion: context.session.accessVersion,
      csrfToken: context.session.csrf!,
      ...(signal === undefined ? {} : { signal }),
    })
  );
  return StepupChallengeSchema.parse(value);
}

export async function completeFinancePolicyStepup(context: ConsoleContext, prepared: PreparedFinancePolicyChange, challenge: string, code: string, signal?: AbortSignal): Promise<string> {
  assertPolicyCommandAvailable(context);
  if (!/^\d{6}$/.test(code)) throw new Error('FINANCE_POLICY_STEPUP_CODE_INVALID');
  const request = Object.freeze({ path: prepared.path, query: Object.freeze({}), body: prepared.body });
  const value = await stepupComplete(
    {
      body: {
        challenge,
        code,
        action: {
          operation: 'finance.policies.manage',
          resource: context.scope.id,
          idempotencyKey: prepared.idempotencyKey,
          expectedVersion: prepared.intent.policy.version,
          requestHash: prepared.requestHash,
          request,
        },
      },
    },
    consoleCommand(context.scope, {
      accessVersion: context.session.accessVersion,
      csrfToken: context.session.csrf!,
      ...(signal === undefined ? {} : { signal }),
    })
  );
  const proof = ActionProofReceiptSchema.parse(value).actionProof;
  if (proof.scope !== context.scope.id || proof.resource !== context.scope.id || proof.idempotencyKey !== prepared.idempotencyKey || proof.expectedVersion !== prepared.intent.policy.version || proof.requestHash !== prepared.requestHash) {
    throw new Error('FINANCE_POLICY_ACTION_PROOF_MISMATCH');
  }
  return proof.proof;
}

export async function executeFinancePolicyChange(context: ConsoleContext, prepared: PreparedFinancePolicyChange, proof: string, signal?: AbortSignal): Promise<FinancePolicyManageReceipt> {
  assertPolicyCommandAvailable(context);
  const value = await policiesManage(
    { path: prepared.path, body: prepared.body },
    createRequestContext(appConfig.clientVersion, {
      scope: context.scope,
      accessVersion: context.session.accessVersion,
      csrfToken: context.session.csrf!,
      idempotencyKey: prepared.idempotencyKey,
      expectedVersion: prepared.intent.policy.version,
      proof,
      ...(signal === undefined ? {} : { signal }),
    })
  );
  const receipt = PolicyManageReceiptSchema.parse(value);
  const policy = receipt.policy;
  if (policy.id !== prepared.intent.policy.id || policy.scopeId !== context.scope.id || policy.previewHash !== prepared.preview.previewHash) {
    throw new Error('FINANCE_POLICY_RECEIPT_MISMATCH');
  }
  parseWireRule(policy.kind, policy.rule);
  return receipt;
}

function assertPolicyCommandAvailable(context: ConsoleContext): void {
  if (!financePolicyWritesAvailable(context)) throw new Error('FINANCE_POLICY_WRITE_NOT_AVAILABLE');
}

function parseIntentRule(policy: FinanceConfigPolicy): ContractJsonObject {
  return contractJsonObject(policy.kind === 'tax' ? FinanceTaxRuleSchema.parse(policy.rule) : FinanceFieldDefinitionSchema.parse(policy.rule));
}

function parseWireRule(kind: 'tax' | 'field-definition', rule: Readonly<Record<string, unknown>>): void {
  if (kind === 'tax') FinanceTaxRuleSchema.parse(rule);
  else FinanceFieldDefinitionSchema.parse(rule);
}

function contractJsonObject(value: unknown): ContractJsonObject {
  const parsed = ContractJsonValueSchema.parse(value);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('FINANCE_POLICY_JSON_OBJECT_INVALID');
  return parsed as ContractJsonObject;
}

function assertPreviewBinding(context: ConsoleContext, intent: FinancePolicyIntent, preview: FinancePolicyPreviewReceipt['preview'], rule: Readonly<Record<string, unknown>>): void {
  if (
    preview.policyId !== intent.policy.id ||
    preview.scopeId !== context.scope.id ||
    preview.action !== intent.action ||
    preview.kind !== intent.policy.kind ||
    preview.desiredState !== intent.desiredState ||
    preview.sourceVersion !== intent.policy.version ||
    canonicalJson(preview.rule) !== canonicalJson(rule)
  ) {
    throw new Error('FINANCE_POLICY_PREVIEW_MISMATCH');
  }
  parseWireRule(preview.kind, preview.rule);
  if (Date.parse(preview.expiresAt) <= Date.now()) throw new Error('FINANCE_POLICY_PREVIEW_EXPIRED');
}

function requiredReason(value: string): string {
  const reason = value.trim();
  if (reason.length === 0 || reason.length > 1000) throw new Error('FINANCE_POLICY_REASON_INVALID');
  return reason;
}

async function sha256(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortJson(Reflect.get(value, key))])
  );
}
