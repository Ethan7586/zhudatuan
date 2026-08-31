import { DomainError } from '../../../../foundation/domain/DomainError';
import type { ModuleContext } from '../../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../../foundation/application/AuditSink';
import { ModuleOperations, operationLifecycle, requireAccess, rowResult } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import { KMS_CLIENT } from '../../../../foundation/infrastructure/KmsClient';
import { DATABASE_POOL } from '../../../../foundation/persistence/Pool';
import { SECURITY_KEYS } from '../../../../foundation/infrastructure/SecretStore';
import { SystemClock } from '../../../../foundation/domain/Clock';
import { ORGANIZATION_READ_PORT } from '../../../organization/public';
import { financeLifecycleOperations } from '../../FinanceLifecycleOperations';
import { resolveDifferenceOperations } from '../../application/command/ResolveDifference';
import { requestInvoiceOperations } from '../../application/command/RequestInvoice';
import { closeSettlementOperations } from '../../application/command/CloseSettlement';
import { requestWithdrawalOperations } from '../../application/command/RequestWithdrawal';
import { getFinanceOverviewOperations } from '../../application/query/GetFinanceOverview';
import { getBillsOperations } from '../../application/query/GetBills';
import { getInvoicesOperations } from '../../application/query/GetInvoices';
import { SettlementPolicy } from '../../domain/policy/SettlementPolicy';
import { PgFinanceRepository } from '../../infrastructure/persistence/PgFinanceRepository';
import { PgPolicyRepository } from '../../infrastructure/persistence/PgPolicyRepository';
import { PgRepairRepository } from '../../infrastructure/persistence/PgRepairRepository';
import { financePolicyOperations } from '../../application/command/ManageFinancePolicy';
import { repairOperations } from '../../application/command/ManageRepair';
import { PolicyPreview } from '../../domain/policy/PolicyPreview';
import { RepairPolicy } from '../../domain/policy/RepairPolicy';
import { MEMBER_ACCESS_PORT } from '../../../access/public';
import { OBJECT_STORE } from '../../../../foundation/infrastructure/ObjectStore';

const settlementPolicy = new SettlementPolicy();

export function financeRoutes(context: ModuleContext): ModuleOperations {
  const pool = context.service(DATABASE_POOL);
  const kms = context.service(KMS_CLIENT);
  const organization = context.ports.get(ORGANIZATION_READ_PORT);
  const key = context.service(SECURITY_KEYS).quote;
  return new ModuleOperations('finance', pool, context.service(AUDIT_SINK), {
    ...financeLifecycleOperations(organization),
    ...resolveDifferenceOperations(),
    ...requestInvoiceOperations((database) => new PgFinanceRepository(database)),
    ...closeSettlementOperations((database) => new PgFinanceRepository(database)),
    ...requestWithdrawalOperations((database) => new PgFinanceRepository(database)),
    ...getFinanceOverviewOperations(organization),
    ...getBillsOperations(organization),
    ...getInvoicesOperations(context.ports.get(MEMBER_ACCESS_PORT), context.service(OBJECT_STORE)),
    ...financePolicyOperations({ scopes: (database, scopeId) => organization.descendants(database, scopeId), repository: (database) => new PgPolicyRepository(database), preview: new PolicyPreview(key), clock: SystemClock }),
    ...repairOperations({ scopes: (database, scopeId) => organization.descendants(database, scopeId), repository: (database) => new PgRepairRepository(database), policy: new RepairPolicy(key), clock: SystemClock }),
    'finance.policies.manage': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const rule = body.rule;
      if (!rule || typeof rule !== 'object' || Array.isArray(rule)) throw new DomainError('VALIDATION_FAILED', { field: 'rule' });
      const kind = textField(body, 'kind');
      if (kind === 'settlement') settlementPolicy.split(10_000, rule);
      const scope = await organization.scope(database, access.scope.id);
      const repository = new PgFinanceRepository(database);
      await validateMallPolicy(repository, scope, kind, rule as Readonly<Record<string, unknown>>);
      const result = await repository.managePolicy({ id: request.input.path.policyid!, scopeId: access.scope.id, kind, rule: rule as Readonly<Record<string, unknown>>, expectedVersion: request.input.expectedVersion ?? null });
      if (!result.rows[0]) throw new DomainError('VERSION_CONFLICT');
      return rowResult(result);
    },
    'invoice.profiles.manage': operationLifecycle({
      prepare: async (request) => {
        const access = requireAccess(request);
        const body = bodyRecord(request);
        const [title, taxid, address] = await Promise.all([
          kms.encrypt('pii', 'pii/invoice', textField(body, 'title'), { owner: access.scope.id, field: 'title' }),
          kms.encrypt('pii', 'pii/invoice', textField(body, 'taxid'), { owner: access.scope.id, field: 'taxid' }),
          body.address ? kms.encrypt('pii', 'pii/invoice', String(body.address), { owner: access.scope.id, field: 'address' }) : Promise.resolve(null),
        ]);
        return { access, body, title, taxid, address };
      },
      execute: async (request, database, { access, body, title, taxid, address }) => {
        const result = await new PgFinanceRepository(database).manageInvoiceProfile({
          id: request.input.path.profileid!,
          ownerId: access.scope.id,
          title,
          taxid,
          address,
          titleMasked: maskTitle(textField(body, 'title')),
          taxidMasked: maskTaxid(textField(body, 'taxid')),
          expectedVersion: request.input.expectedVersion ?? null,
        });
        if (!result.rows[0]) throw new DomainError('VERSION_CONFLICT');
        return rowResult(result);
      },
    }),
  });
}

function maskTitle(value: string): string {
  return value.length < 3 ? `${value.slice(0, 1)}*` : `${value.slice(0, 2)}${'*'.repeat(Math.min(6, value.length - 2))}`;
}

function maskTaxid(value: string): string {
  return value.length < 8 ? '****' : `${value.slice(0, 4)}********${value.slice(-4)}`;
}

async function validateMallPolicy(repository: PgFinanceRepository, scope: Readonly<{ scopeKind: string; ancestors: readonly string[] }>, kind: string, rule: Readonly<Record<string, unknown>>): Promise<void> {
  if (scope.scopeKind !== 'mall') return;
  if (!['invoice', 'reconciliation', 'threshold'].includes(kind)) throw new Error('MALL_FINANCE_POLICY_KIND_FORBIDDEN');
  const guard = await repository.policyGuard(scope.ancestors);
  if (!guard || !guard.allowedKinds.includes(kind)) throw new Error('MALL_FINANCE_POLICY_NOT_DELEGATED');
  if (kind === 'threshold' && typeof rule.amountMinor === 'number') {
    if (!Number.isSafeInteger(rule.amountMinor) || rule.amountMinor < 0 || !Number.isSafeInteger(guard.maximumThresholdMinor) || rule.amountMinor > guard.maximumThresholdMinor!) throw new Error('MALL_FINANCE_THRESHOLD_OUT_OF_RANGE');
  }
}
