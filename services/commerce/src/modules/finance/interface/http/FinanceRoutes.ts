import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../../foundation/application/AuditSink';
import { ModuleOperations, operationLifecycle, operationRequestHash, requireAccess, rowResult, type OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, keysetResult, queryPage, textField } from '../../../../foundation/interface/Validation';
import { KMS_CLIENT } from '../../../../foundation/infrastructure/KmsClient';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { financeLifecycleOperations } from '../../FinanceLifecycleOperations';
import { resolveDifferenceOperations } from '../../application/command/ResolveDifference';
import { reconciliationRepairOperations } from '../../application/command/ReconciliationRepair';
import { requestInvoiceOperations } from '../../application/command/RequestInvoice';
import { closeSettlementOperations } from '../../application/command/CloseSettlement';
import { requestWithdrawalOperations } from '../../application/command/RequestWithdrawal';
import { getFinanceOverviewOperations } from '../../application/query/GetFinanceOverview';
import { getBillsOperations } from '../../application/query/GetBills';
import { getInvoicesOperations } from '../../application/query/GetInvoices';
import { getReconciliationRepairOperations } from '../../application/query/GetReconciliationRepair';
import { ConfigFieldPolicy } from '../../domain/policy/ConfigFieldPolicy';
import { SettlementPolicy } from '../../domain/policy/SettlementPolicy';
import { PgFinanceRepository } from '../../infrastructure/persistence/PgFinanceRepository';

const settlementPolicy = new SettlementPolicy();
const configurablePolicy = new ConfigFieldPolicy();
const previewPolicyFields = Object.freeze(new Set(['action', 'kind', 'rule', 'desiredState']));
const managePolicyFields = Object.freeze(new Set(['action', 'previewHash', 'reason', 'evidence']));

export function financeRoutes(context: ModuleContext): ModuleOperations {
  const pool = context.container.get(DATABASE_POOL);
  const kms = context.container.get(KMS_CLIENT);
  return new ModuleOperations('finance', pool, context.container.get(AUDIT_SINK), {
    ...financeLifecycleOperations(),
    ...resolveDifferenceOperations(),
    ...reconciliationRepairOperations(),
    ...requestInvoiceOperations((database) => new PgFinanceRepository(database)),
    ...closeSettlementOperations((database) => new PgFinanceRepository(database)),
    ...requestWithdrawalOperations((database) => new PgFinanceRepository(database)),
    ...getFinanceOverviewOperations(),
    ...getBillsOperations(),
    ...getInvoicesOperations(),
    ...getReconciliationRepairOperations(),
    'finance.policies.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const result = await database.query(
        `with latest as(
          select distinct on(revision.policy_id) revision.policy_id id,revision.scope_id,revision.kind,revision.rule,
            case revision.state when 'submitted' then 'pending_review' when 'rejected' then 'draft' else revision.state end state,
            revision.version,revision.desired_state,revision.effective_from,revision.effective_to,
            revision.revision_hash,revision.preview_hash,revision.proposed_by,revision.submitted_by,
            revision.approved_by,revision.rejected_by
          from finance.policyrevision revision
          where access.scope_allowed(revision.scope_id)
            and revision.scope_id in(select descendant_id from organization.unitclosure where ancestor_id=$1)
          order by revision.policy_id,revision.version desc
        ),visible as(
          select * from latest
          union all
          select policy.id,policy.scope_id,policy.kind,policy.rule,policy.state,policy.version,
            case policy.state when 'retired' then 'retired' else 'active' end,
            null::date,null::date,null::char(64),null::char(64),null::text,null::text,null::text,null::text
          from finance.policy policy where access.scope_allowed(policy.scope_id)
            and policy.scope_id in(select descendant_id from organization.unitclosure where ancestor_id=$1)
            and not exists(select 1 from latest where latest.id=policy.id)
        ) select * from visible where ($2::text is null or id>$2) order by id limit $3`,
        [access.scope.id, page.id, page.fetch]
      );
      return keysetResult(result, page, 'id');
    },
    'finance.audit.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request, 200);
      const result = await database.query(
        `select record.id,record.scope_id,record.actor_id,record.actor_type,record.action,
        record.resource_type,record.resource_id,record.before_hash,record.after_hash,record.evidence,record.trace_id,
        record.previous_hash,record.record_hash,record.recorded_at from audit.record record
        where record.scope_id in(select descendant_id from organization.unitclosure where ancestor_id=$1)
          and (record.action like 'finance.%' or record.action like 'invoice.%'
            or record.resource_type in('finance','invoice'))
          and ($2::timestamptz is null or (record.recorded_at,record.id)<($2::timestamptz,$3))
        order by record.recorded_at desc,record.id desc limit $4`,
        [access.scope.id, page.sort, page.id, page.fetch]
      );
      return keysetResult(result, page, 'recorded_at');
    },
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
      const range = ['tax', 'field-definition'].includes(kind) ? configurablePolicy.effectiveRange(rule) : { from: '1970-01-01', to: null };
      const result = await database.query<{ receipt: unknown }>(`select finance.preview_configurable_policy($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::date,$11::date) receipt`, [
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
      ]);
      return policyReceipt(result, 'preview', 201);
    },
    'finance.policies.manage': async (request, database) => {
      const access = requireAccess(request);
      const body = strictBody(request, managePolicyFields);
      const result = await database.query<{ receipt: unknown }>(`select finance.manage_configurable_policy($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10) receipt`, [
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
      ]);
      return policyReceipt(result, 'policy');
    },
    'invoice.profiles.manage': operationLifecycle({
      prepare: async (request) => {
        const access = requireAccess(request);
        const body = bodyRecord(request);
        const [title, taxid, address] = await Promise.all([
          kms.encrypt('pii/invoice', textField(body, 'title'), { owner: access.scope.id, field: 'title' }),
          kms.encrypt('pii/invoice', textField(body, 'taxid'), { owner: access.scope.id, field: 'taxid' }),
          body.address ? kms.encrypt('pii/invoice', String(body.address), { owner: access.scope.id, field: 'address' }) : Promise.resolve(null),
        ]);
        return { access, body, title, taxid, address };
      },
      execute: async (request, database, { access, body, title, taxid, address }) => {
        const result = await database.query(
          `insert into invoice.profile(id,owner_id,title_ciphertext,title_key_version,taxid_ciphertext,taxid_token,taxid_key_version,address_ciphertext,address_key_version,status,version)
        select $1,$2,$3,$4,$5,$6,$7,$8,$9,'active',0 where $10::bigint=0
        on conflict(id) do update set title_ciphertext=excluded.title_ciphertext,title_key_version=excluded.title_key_version,
        taxid_ciphertext=excluded.taxid_ciphertext,taxid_token=excluded.taxid_token,taxid_key_version=excluded.taxid_key_version,address_ciphertext=excluded.address_ciphertext,
        address_key_version=excluded.address_key_version,version=invoice.profile.version+1 where invoice.profile.owner_id=$2
        and invoice.profile.version=$10 returning id,owner_id,status,version`,
          [request.input.path.profileid!, access.scope.id, title.ciphertext, title.keyVersion, taxid.ciphertext, taxid.fingerprint, taxid.keyVersion, address?.ciphertext ?? null, address?.keyVersion ?? null, request.input.expectedVersion!]
        );
        if (!result.rows[0]) throw new Error('VERSION_CONFLICT');
        return rowResult(result);
      },
    }),
  });
}

async function validateMallPolicy(database: OperationDatabase, scope: string, scopeKind: string, kind: string, rule: Readonly<Record<string, unknown>>): Promise<void> {
  if (scopeKind !== 'mall') return;
  if (!['invoice', 'reconciliation', 'threshold', 'tax', 'field-definition'].includes(kind)) throw new Error('MALL_FINANCE_POLICY_KIND_FORBIDDEN');
  const parent = await database.query<{ rule: Readonly<Record<string, unknown>> }>(
    `select policy.rule from organization.unitclosure closure
    join organization.organization organization on organization.id=closure.ancestor_id
    join finance.policy policy on policy.scope_id=organization.id and policy.kind='mallfinance' and policy.state='active'
    where closure.descendant_id=$1 and closure.depth>0 order by closure.depth limit 1`,
    [scope]
  );
  const guard = parent.rows[0]?.rule;
  if (!guard || !Array.isArray(guard.allowedKinds) || !guard.allowedKinds.includes(kind)) throw new Error('MALL_FINANCE_POLICY_NOT_DELEGATED');
  if (kind === 'threshold' && typeof rule.amountMinor === 'number') {
    if (!Number.isSafeInteger(rule.amountMinor) || rule.amountMinor < 0 || !Number.isSafeInteger(guard.maximumThresholdMinor) || rule.amountMinor > (guard.maximumThresholdMinor as number))
      throw new Error('MALL_FINANCE_THRESHOLD_OUT_OF_RANGE');
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

function policyReceipt(result: Readonly<{ rows: readonly { receipt: unknown }[] }>, field: 'preview' | 'policy', status = 200): OperationResult {
  const receipt = result.rows[0]?.receipt;
  if (receipt === null || typeof receipt !== 'object' || Array.isArray(receipt)) throw new Error('CONTRACT_RESPONSE_INVALID:finance.policy');
  const value = Reflect.get(receipt, field);
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`CONTRACT_RESPONSE_INVALID:finance.policy.${field}`);
  const version = Reflect.get(value, field === 'preview' ? 'sourceVersion' : 'version');
  if (!((typeof version === 'string' && /^(0|[1-9][0-9]*)$/.test(version)) || (Number.isSafeInteger(version) && (version as number) >= 0))) {
    throw new Error('CONTRACT_RESPONSE_INVALID:finance.policy.version');
  }
  return { status, body: receipt, headers: { etag: `"${String(version)}"` } };
}
