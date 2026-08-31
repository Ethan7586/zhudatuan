import type { OperationDatabase } from '../../foundation/application/ModuleOperations';
import { EvaluateRisk } from './application/command/EvaluateRisk';
import { signal } from './domain/model/Signal';
import { PgRiskRepository } from './infrastructure/persistence/PgRiskRepository';
import type { CheckoutRiskInput, CheckoutRiskPort } from './public';

export class CheckoutRisk implements CheckoutRiskPort {
  async assess(database: OperationDatabase, input: CheckoutRiskInput) {
    return new EvaluateRisk(new PgRiskRepository(database)).check({
      actor: input.actor,
      operation: input.operation,
      resource: input.resource,
      scope: input.scope,
      scopes: input.scopes,
      trace: input.trace,
      amountMinor: input.amountMinor,
      signals: Object.freeze(Object.entries(input.signals).map(([type, value]) => signal(type, value, new Date().toISOString()))),
    });
  }
}
