import type { DatabasePool } from '../../../../platform/database/Pool';
import type { RiskAssessment, RiskGate } from '../../../../platform/security/RiskGate';
import { signal } from '../../domain/model/Signal';
import { EvaluateRisk } from '../../application/service/EvaluateRisk';
import { PgRiskRepository, riskPolicyRecords, riskPolicySql, type PolicyRow } from './PgRiskRepository';
import type { RiskPolicyRecord } from '../../application/port/RiskCheck';
import { PgTransactionManager } from '../../../../platform/database/PgTransactionManager';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { OperationCatalog } from '@shop/contract';
import { pgContextParameters, pgContextValues } from '../../../../platform/database/PgContext';
import type { TransactionOptions } from '../../../../platform/database/TransactionManager';

export class RiskCheckAdapter implements RiskGate {
  private readonly transactions: PgTransactionManager;
  private readonly access = new PgTransactionAccess();
  constructor(
    pool: DatabasePool,
    private readonly queries: DatabasePool | null = null
  ) {
    this.transactions = new PgTransactionManager(pool);
  }

  async evaluate(input: Parameters<RiskGate['evaluate']>[0]): Promise<RiskAssessment> {
    const options: TransactionOptions = {
      tenant: input.scope.tenant ?? '',
      membership: input.actor.membership,
      scope: input.scope.id,
      actor: input.actor.id,
      trace: input.trace,
      operation: input.operation,
      deadline: input.deadline,
      signal: input.signal,
    };
    const operation = OperationCatalog.get(input.operation);
    const hierarchy = [...input.scope.path.map(({ id }) => id), input.scope.id];
    if (input.actor.membership === 'public') hierarchy.push('organization-platform-root');
    const scopes = Object.freeze([...new Set(hierarchy)]);
    let policies: readonly RiskPolicyRecord[] | undefined;
    try {
      if (this.queries === null) throw new Error('RISK_PREFETCH_UNAVAILABLE');
      available(input);
      const result = await this.queries.query<PolicyRow>(`with request_context as materialized (${pgContextParameters(1)}) ${riskPolicySql(10, 'request_context')}`, [...pgContextValues(options), scopes]);
      available(input);
      policies = riskPolicyRecords(result.rows);
      if (policies.length === 0) return Object.freeze({ outcome: 'allow', safeReason: 'policy', decision: null });
    } catch {
      policies = undefined;
    }
    return this.transactions.write(
      options,
      async (context) => {
        return new EvaluateRisk(new PgRiskRepository(this.access.database(context), policies)).check({
          actor: input.actor.id,
          operation: input.operation,
          resource: input.resource ?? null,
          scope: input.scope.id,
          scopes,
          trace: input.trace,
          amountMinor: input.amountMinor ?? null,
          signals: Object.entries(input.signals ?? {}).map(([type, value]) =>
            signal({
              type,
              version: 1,
              value,
              source: `operation:${input.operation}`,
              sensitivity: type.includes('device') || type.includes('ip') ? 'sensitive' : 'personal',
              observedAt: new Date().toISOString(),
            })
          ),
          risk: operation.risk,
          mode: operation.executionMode === 'async' ? 'async' : 'sync',
          deadline: input.deadline,
          signal: input.signal,
        });
      }
    );
  }
}

function available(input: Readonly<{ deadline: number; signal: AbortSignal }>): void {
  if (input.signal.aborted) throw input.signal.reason ?? new Error('RISK_CHECK_ABORTED');
  if (!Number.isFinite(input.deadline) || input.deadline <= Date.now()) throw new Error('DEADLINE_EXCEEDED');
}
