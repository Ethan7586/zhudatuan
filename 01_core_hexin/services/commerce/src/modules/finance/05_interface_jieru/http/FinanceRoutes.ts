import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../../foundation/application/AuditSink';
import { ModuleOperations, operationLifecycle, requireAccess, rowResult, type OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import { KMS_CLIENT } from '../../../../foundation/infrastructure/KmsClient';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { financeLifecycleOperations } from '../../FinanceLifecycleOperations';
import { resolveDifferenceOperations } from '../../03_application_yingyong/command/ResolveDifference';
import { reconciliationRepairOperations } from '../../03_application_yingyong/command/ReconciliationRepair';
import { requestInvoiceOperations } from '../../03_application_yingyong/command/RequestInvoice';
import { closeSettlementOperations } from '../../03_application_yingyong/command/CloseSettlement';
import { requestWithdrawalOperations } from '../../03_application_yingyong/command/RequestWithdrawal';
import { getFinanceOverviewOperations } from '../../03_application_yingyong/query/GetFinanceOverview';
import { getBillsOperations } from '../../03_application_yingyong/query/GetBills';
import { getInvoicesOperations } from '../../03_application_yingyong/query/GetInvoices';
import { getReconciliationRepairOperations } from '../../03_application_yingyong/query/GetReconciliationRepair';
import { SettlementPolicy } from '../../02_domain_yewu/policy/SettlementPolicy';
import { PgFinanceRepository } from '../../04_adapters_shixian/persistence/PgFinanceRepository';

const settlementPolicy = new SettlementPolicy();

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
    'finance.policies.manage': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const rule = body.rule;
      if (!rule || typeof rule !== 'object' || Array.isArray(rule)) throw new Error('VALIDATION_FAILED:rule');
      const kind = textField(body, 'kind');
      if (kind === 'settlement') settlementPolicy.split(10_000, rule);
      await validateMallPolicy(database, access.scope.id, access.scope.kind, kind, rule as Readonly<Record<string, unknown>>);
      const result = await database.query(`insert into finance.policy(id,scope_id,kind,rule,state,version) values($1,$2,$3,$4::jsonb,'active',0)
        on conflict(id) do update set kind=excluded.kind,rule=excluded.rule,state='active',version=finance.policy.version+1
        where finance.policy.scope_id=$2 and ($5::bigint is null or finance.policy.version=$5) returning *`,
      [request.input.path.policyid!, access.scope.id, kind, JSON.stringify(rule), request.input.expectedVersion ?? null]);
      if (!result.rows[0]) throw new Error('VERSION_CONFLICT');
      return rowResult(result);
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
      const result = await database.query(`insert into invoice.profile(id,owner_id,title_ciphertext,title_key_version,taxid_ciphertext,taxid_token,taxid_key_version,address_ciphertext,address_key_version,status,version)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',0) on conflict(id) do update set title_ciphertext=excluded.title_ciphertext,title_key_version=excluded.title_key_version,
        taxid_ciphertext=excluded.taxid_ciphertext,taxid_token=excluded.taxid_token,taxid_key_version=excluded.taxid_key_version,address_ciphertext=excluded.address_ciphertext,
        address_key_version=excluded.address_key_version,version=invoice.profile.version+1 where invoice.profile.owner_id=$2
        and ($10::bigint is null or invoice.profile.version=$10) returning id,owner_id,status,version`,
      [request.input.path.profileid!, access.scope.id, title.ciphertext, title.keyVersion, taxid.ciphertext, taxid.fingerprint, taxid.keyVersion,
        address?.ciphertext ?? null, address?.keyVersion ?? null, request.input.expectedVersion ?? null]);
      if (!result.rows[0]) throw new Error('VERSION_CONFLICT');
        return rowResult(result);
      },
    }),
  });
}

async function validateMallPolicy(database: OperationDatabase, scope: string, scopeKind: string, kind: string,
  rule: Readonly<Record<string, unknown>>): Promise<void> {
  if (scopeKind !== 'mall') return;
  if (!['invoice', 'reconciliation', 'threshold'].includes(kind)) throw new Error('MALL_FINANCE_POLICY_KIND_FORBIDDEN');
  const parent = await database.query<{ rule: Readonly<Record<string, unknown>> }>(`select policy.rule from organization.unitclosure closure
    join organization.organization organization on organization.id=closure.ancestor_id
    join finance.policy policy on policy.scope_id=organization.id and policy.kind='mallfinance' and policy.state='active'
    where closure.descendant_id=$1 and closure.depth>0 order by closure.depth limit 1`, [scope]);
  const guard = parent.rows[0]?.rule;
  if (!guard || !Array.isArray(guard.allowedKinds) || !guard.allowedKinds.includes(kind)) throw new Error('MALL_FINANCE_POLICY_NOT_DELEGATED');
  if (kind === 'threshold' && typeof rule.amountMinor === 'number') {
    if (!Number.isSafeInteger(rule.amountMinor) || rule.amountMinor < 0 || !Number.isSafeInteger(guard.maximumThresholdMinor)
      || rule.amountMinor > (guard.maximumThresholdMinor as number)) throw new Error('MALL_FINANCE_THRESHOLD_OUT_OF_RANGE');
  }
}
