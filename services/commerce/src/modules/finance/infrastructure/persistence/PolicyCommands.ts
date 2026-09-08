import { rowResult } from '../../../../platform/database/DatabaseResult';
import { requireAccess } from '../../../../pipeline/OperationAccess';
import { DomainError } from '../../../../platform/error/DomainError';
import { bodyRecord, textField } from '../../../../pipeline/Validation';
import { ReconciliationPolicy } from '../../domain/policy/ReconciliationPolicy';
import { SettlementPolicy } from '../../domain/policy/SettlementPolicy';
import { PgPolicyRepository } from './PgPolicyRepository';
import type { FinanceScopeQuery } from './FinanceScopeQuery';
import type { FinanceEntries } from './FinanceOperation';
import { financeEntries, positive, text, time } from './PolicyActions';
import { FinancePolicy } from '../../domain/model/FinancePolicy';
import type { PolicyPreview } from '../../domain/policy/PolicyPreview';
import type { Clock } from '@shop/kernel';

const settlementPolicy = new SettlementPolicy();
const reconciliationPolicy = new ReconciliationPolicy();

export function policyCommands(scopes: FinanceScopeQuery, previews: PolicyPreview, clock: Clock): FinanceEntries<'policiesManage'> {
  return {
    policiesManage: async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request.input);
      const rule = body.rule;
      if (!rule || typeof rule !== 'object' || Array.isArray(rule)) throw new DomainError('VALIDATION_FAILED', { field: 'rule' });
      const kind = textField(body, 'kind');
      if (kind === 'settlement') settlementPolicy.split(10_000, rule);
      if (kind === 'threshold') reconciliationPolicy.threshold(rule);
      const accounting = kind === 'accounting' ? accountingPolicy(request.input.path.policyid!, rule, request.input.expectedVersion, previews, clock) : null;
      const scope = await scopes.describe(database, access.scope.id);
      const repository = new PgPolicyRepository(database);
      await validateMallPolicy(repository, scope, kind, rule as Readonly<Record<string, unknown>>);
      const persistedRule =
        accounting === null
          ? (rule as Readonly<Record<string, unknown>>)
          : Object.freeze({
              name: accounting.name,
              trigger: accounting.trigger,
              entries: accounting.entries,
              effectiveAt: accounting.effectiveAt,
              expiresAt: accounting.expiresAt,
              targetStatus: accounting.status,
            });
      const result = await repository.manage({
        id: request.input.path.policyid!,
        scopeId: access.scope.id,
        kind,
        rule: persistedRule,
        state: accounting?.status === 'retired' ? 'retired' : 'active',
        name: accounting?.name ?? kind,
        trigger: accounting?.trigger ?? kind,
        entries: accounting?.entries ?? [],
        effectiveAt: accounting?.effectiveAt ?? clock.now().toISOString(),
        expiresAt: accounting?.expiresAt ?? null,
        expectedVersion: request.input.expectedVersion ?? null,
      });
      if (!result.rows[0]) throw new DomainError('VERSION_CONFLICT');
      return rowResult(result);
    },
  };
}

function accountingPolicy(id: string, rule: unknown, expectedVersion: number | undefined, previews: PolicyPreview, clock: Clock): FinancePolicy {
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) throw new DomainError('VALIDATION_FAILED', { field: 'rule' });
  const value = rule as Readonly<Record<string, unknown>>;
  const version = positive(expectedVersion, 'expectedVersion');
  const status = value.targetStatus === 'active' || value.targetStatus === 'retired' ? value.targetStatus : null;
  if (status === null) throw new DomainError('VALIDATION_FAILED', { field: 'targetStatus' });
  const policy = new FinancePolicy(
    id,
    text(value.name, 'name'),
    status,
    text(value.trigger, 'trigger'),
    financeEntries(value.entries),
    time(value.effectiveAt, 'effectiveAt'),
    value.expiresAt === null ? null : time(value.expiresAt, 'expiresAt'),
    version
  );
  const sample = Object.freeze({ from: time(value.sampleFrom, 'sampleFrom'), to: time(value.sampleTo, 'sampleTo'), affectedCount: positiveOrZero(value.affectedCount) });
  previews.verify(text(value.previewToken, 'previewToken'), { policy, sample, previewHash: hash(value.previewHash) }, clock.now());
  return policy;
}

function positiveOrZero(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new DomainError('VALIDATION_FAILED', { field: 'affectedCount' });
  return value as number;
}

function hash(value: unknown): string {
  const result = text(value, 'previewHash');
  if (!/^[a-f0-9]{64}$/.test(result)) throw new DomainError('VALIDATION_FAILED', { field: 'previewHash' });
  return result;
}

async function validateMallPolicy(repository: PgPolicyRepository, scope: Readonly<{ scopeKind: string; ancestors: readonly string[] }>, kind: string, rule: Readonly<Record<string, unknown>>): Promise<void> {
  if (scope.scopeKind !== 'mall') return;
  if (!['accounting', 'invoice', 'reconciliation', 'threshold'].includes(kind)) throw new Error('MALL_FINANCE_POLICY_KIND_FORBIDDEN');
  const guard = await repository.guard(scope.ancestors);
  if (!guard || !guard.allowedKinds.includes(kind)) throw new Error('MALL_FINANCE_POLICY_NOT_DELEGATED');
  if (kind === 'threshold' && typeof rule.amountMinor === 'number') {
    if (!Number.isSafeInteger(rule.amountMinor) || rule.amountMinor < 0 || !Number.isSafeInteger(guard.maximumThresholdMinor) || rule.amountMinor > guard.maximumThresholdMinor!) throw new Error('MALL_FINANCE_THRESHOLD_OUT_OF_RANGE');
  }
}
