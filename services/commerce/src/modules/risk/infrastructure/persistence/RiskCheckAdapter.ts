import type { DatabasePool } from '../../../../platform/database/Pool';
import type { RiskAssessment, RiskGate } from '../../../../platform/security/RiskGate';
import { signal } from '../../domain/model/Signal';
import { EvaluateRisk } from '../../application/service/EvaluateRisk';
import { PgRiskRepository } from './PgRiskRepository';
import { PgTransactionManager } from '../../../../platform/database/PgTransactionManager';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { OperationCatalog } from '@shop/contract';

export class RiskCheckAdapter implements RiskGate {
  private readonly transactions: PgTransactionManager;
  private readonly access = new PgTransactionAccess();
  constructor(pool: DatabasePool) {
    this.transactions = new PgTransactionManager(pool);
  }

  async evaluate(input: Parameters<RiskGate['evaluate']>[0]): Promise<RiskAssessment> {
    return this.transactions.write(
      { tenant: input.scope.tenant ?? '', membership: input.actor.membership, scope: input.scope.id, actor: input.actor.id, trace: input.trace, operation: input.operation, deadline: input.deadline, signal: input.signal },
      async (context) => {
        const operation = OperationCatalog.get(input.operation);
        const hierarchy = [...input.scope.path.map(({ id }) => id), input.scope.id];
        if (input.actor.membership === 'public') hierarchy.push('organization-platform-root');
        return new EvaluateRisk(new PgRiskRepository(this.access.database(context))).check({
          actor: input.actor.id,
          operation: input.operation,
          resource: input.resource ?? null,
          scope: input.scope.id,
          scopes: Object.freeze([...new Set(hierarchy)]),
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
