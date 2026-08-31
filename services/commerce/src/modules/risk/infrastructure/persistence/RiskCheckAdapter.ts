import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type { RiskAssessment, RiskGate } from '../../../../foundation/security/RiskGate';
import { signal } from '../../domain/model/Signal';
import { EvaluateRisk } from '../../application/command/EvaluateRisk';
import { PgRiskRepository } from './PgRiskRepository';
import { applyApiDatabaseContext } from '../../../../foundation/infrastructure/DatabaseContext';

export class RiskCheckAdapter implements RiskGate {
  constructor(private readonly pool: DatabasePool) {}

  async evaluate(input: Parameters<RiskGate['evaluate']>[0]): Promise<RiskAssessment> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await applyApiDatabaseContext(client, { tenant: input.scope.tenant ?? '', membership: input.actor.membership, scope: input.scope.id, actor: input.actor.id, trace: input.trace });
      const hierarchy = [...input.scope.path.map(({ id }) => id), input.scope.id];
      if (input.actor.membership === 'public') hierarchy.push('organization-platform-root');
      const outcome = await new EvaluateRisk(new PgRiskRepository(client)).check({
        actor: input.actor.id,
        operation: input.operation,
        resource: input.resource ?? null,
        scope: input.scope.id,
        scopes: Object.freeze([...new Set(hierarchy)]),
        trace: input.trace,
        amountMinor: input.amountMinor ?? null,
        signals: Object.entries(input.signals ?? {}).map(([type, value]) => signal(type, value, new Date().toISOString())),
      });
      await client.query('commit');
      return outcome;
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      client.release();
    }
  }
}
