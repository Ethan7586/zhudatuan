import type { OperationActions, OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { requireAccess } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, integerField, textField } from '../../../../foundation/interface/Validation';
import { RiskPolicy } from '../../domain/model/RiskPolicy';
import type { RiskRepository } from '../port/RiskCheck';

export type RiskRepositoryFactory = (database: OperationDatabase) => RiskRepository;

export function manageRiskPolicyOperations(factory: RiskRepositoryFactory): OperationActions {
  return {
    'risk.policies.manage': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const action = body.action ?? 'save';
      const repository = factory(database);
      const id = request.input.path.policyid!;
      if (action === 'activate') {
        const version = integerField(body, 'version', 1);
        const rollout = optionalPercent(body.rolloutPercent, 100);
        return { status: 200, body: await repository.activatePolicy({ id, scope: access.scope.id, version, rolloutPercent: rollout, actor: access.actor.id, trace: access.trace }) };
      }
      if (action === 'retire') return { status: 200, body: await repository.retirePolicy(id, access.scope.id) };
      if (action !== 'save') throw new Error('RISK_POLICY_ACTION_INVALID');
      const rollout = optionalPercent(body.rolloutPercent, 100);
      const policy = new RiskPolicy(id, 1, body.rule, rollout);
      const saved = await repository.savePolicy({ id, scope: access.scope.id, name: textField(body, 'name'), rule: policy.rule, ruleHash: policy.hash, rolloutPercent: rollout, actor: access.actor.id });
      return { status: 202, body: saved };
    },
  };
}

function optionalPercent(value: unknown, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 100) throw new Error('RISK_ROLLOUT_INVALID');
  return value as number;
}
