import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationHandler';
import {
  operationRequestHash,
  requireAccess,
  type OperationActions,
  type OperationDatabase,
} from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import { ConfigFieldPolicy } from '../../02_domain_yewu/policy/ConfigFieldPolicy';
import { SettlementPolicy } from '../../02_domain_yewu/policy/SettlementPolicy';

const settlementPolicy = new SettlementPolicy();
const configurablePolicy = new ConfigFieldPolicy();
const previewPolicyFields = Object.freeze(new Set(['action', 'kind', 'rule', 'desiredState']));
const managePolicyFields = Object.freeze(new Set(['action', 'previewHash', 'reason', 'evidence']));

export function financePolicyWorkflowOperations(): OperationActions {
  return {
    'finance.policies.preview': async (request, database) => {
      const access = requireAccess(request);
      const body = strictBody(request, previewPolicyFields);
      const action = policyAction(body.action);
      const kind = textField(body, 'kind');
      const candidate = objectField(body, 'rule');
      const rule = ['tax', 'field-definition'].includes(kind) ? configurablePolicy.validate(kind, candidate) : candidate;
      const desiredState = body.desiredState === 'active' ? 'active' : body.desiredState === 'retired' ? 'retired' : null;
      if (!desiredState) throw new Error('FINANCE_POLICY_DESIRED_STATE_INVALID');
      if (kind === 'settlement') settlementPolicy.split(10_000, rule);
      await validateMallPolicy(database, access.scope.id, access.scope.kind, kind, rule);
      const range = ['tax', 'field-definition'].includes(kind)
        ? configurablePolicy.effectiveRange(rule)
        : { from: '1970-01-01', to: null };
      const result = await database.query<{ receipt: unknown }>(
        `select finance.preview_configurable_policy($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::date,$11::date) receipt`,
        [
          policyIdentifier(request),
          access.scope.id,
          access.actor.id,
          idempotency(request),
          expectedVersion(request),
          action,
          kind,
          JSON.stringify(rule),
          desiredState,
          range.from,
          range.to,
        ],
      );
      return policyReceipt(result, 'preview', 201);
    },
    'finance.policies.manage': async (request, database) => {
      const access = requireAccess(request);
      const body = strictBody(request, managePolicyFields);
      const result = await database.query<{ receipt: unknown }>(
        `select finance.manage_configurable_policy($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10) receipt`,
        [
          policyIdentifier(request),
          access.scope.id,
          access.actor.id,
          idempotency(request),
          expectedVersion(request),
          policyAction(body.action),
          hashField(body, 'previewHash'),
          textField(body, 'reason', 1000),
          JSON.stringify(objectField(body, 'evidence')),
          operationRequestHash(request),
        ],
      );
      return policyReceipt(result, 'policy');
    },
  };
}

async function validateMallPolicy(
  database: OperationDatabase,
  scope: string,
  scopeKind: string,
  kind: string,
  rule: Readonly<Record<string, unknown>>,
): Promise<void> {
  if (scopeKind !== 'mall') return;
  if (!['invoice', 'reconciliation', 'threshold', 'tax', 'field-definition'].includes(kind)) {
    throw new Error('MALL_FINANCE_POLICY_KIND_FORBIDDEN');
  }
  const parent = await database.query<{ rule: Readonly<Record<string, unknown>> }>(
    `select policy.rule from organization.unitclosure closure
    join organization.organization organization on organization.id=closure.ancestor_id
    join finance.policy policy on policy.scope_id=organization.id and policy.kind='mallfinance' and policy.state='active'
    where closure.descendant_id=$1 and closure.depth>0 order by closure.depth limit 1`,
    [scope],
  );
  const guard = parent.rows[0]?.rule;
  if (!guard || !Array.isArray(guard.allowedKinds) || !guard.allowedKinds.includes(kind)) {
    throw new Error('MALL_FINANCE_POLICY_NOT_DELEGATED');
  }
  if (kind === 'threshold' && typeof rule.amountMinor === 'number') {
    if (!Number.isSafeInteger(rule.amountMinor)
      || rule.amountMinor < 0
      || !Number.isSafeInteger(guard.maximumThresholdMinor)
      || rule.amountMinor > (guard.maximumThresholdMinor as number)) {
      throw new Error('MALL_FINANCE_THRESHOLD_OUT_OF_RANGE');
    }
  }
}

function strictBody(request: OperationRequest, allowed: ReadonlySet<string>): Readonly<Record<string, unknown>> {
  const body = bodyRecord(request);
  const unexpected = Object.keys(body).find((field) => !allowed.has(field));
  if (unexpected) throw new Error(`VALIDATION_FAILED:unexpected:${unexpected}`);
  return body;
}

function objectField(body: Readonly<Record<string, unknown>>, field: string): Readonly<Record<string, unknown>> {
  const value = body[field];
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`VALIDATION_FAILED:${field}`);
  try {
    JSON.stringify(value);
  } catch {
    throw new Error(`VALIDATION_FAILED:${field}`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function policyAction(value: unknown): 'saveDraft' | 'submit' | 'approve' | 'reject' {
  if (value === 'saveDraft' || value === 'submit' || value === 'approve' || value === 'reject') return value;
  throw new Error('FINANCE_POLICY_ACTION_INVALID');
}

function hashField(body: Readonly<Record<string, unknown>>, field: string): string {
  const value = textField(body, field, 64);
  if (!/^[0-9a-f]{64}$/.test(value)) throw new Error(`VALIDATION_FAILED:${field}`);
  return value;
}

function policyIdentifier(request: OperationRequest): string {
  const value = request.input.path.policyid;
  if (typeof value !== 'string' || value.length === 0 || value.length > 255) throw new Error('VALIDATION_FAILED:policyid');
  return value;
}

function idempotency(request: OperationRequest): string {
  const value = request.input.idempotency;
  if (typeof value !== 'string' || value.length === 0 || value.length > 255) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
  return value;
}

function expectedVersion(request: OperationRequest): number {
  const value = request.input.expectedVersion;
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error('EXPECTED_VERSION_REQUIRED');
  return value as number;
}

function policyReceipt(
  result: Readonly<{ rows: readonly { receipt: unknown }[] }>,
  field: 'preview' | 'policy',
  status = 200,
): OperationResult {
  const receipt = result.rows[0]?.receipt;
  if (receipt === null || typeof receipt !== 'object' || Array.isArray(receipt)) {
    throw new Error('CONTRACT_RESPONSE_INVALID:finance.policy');
  }
  const value = Reflect.get(receipt, field);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`CONTRACT_RESPONSE_INVALID:finance.policy.${field}`);
  }
  const version = Reflect.get(value, field === 'preview' ? 'sourceVersion' : 'version');
  if (!((typeof version === 'string' && /^(0|[1-9][0-9]*)$/.test(version))
    || (Number.isSafeInteger(version) && (version as number) >= 0))) {
    throw new Error('CONTRACT_RESPONSE_INVALID:finance.policy.version');
  }
  return { status, body: receipt, headers: { etag: `"${String(version)}"` } };
}
