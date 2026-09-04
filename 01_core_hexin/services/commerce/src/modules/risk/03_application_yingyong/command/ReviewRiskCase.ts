import type { OperationActions, OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { requireAccess } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import { RiskCase } from '../../02_domain_yewu/model/RiskCase';
import type { RiskRepository } from '../../01_public_gongkai/RiskCheck';

export function reviewRiskCaseOperations(factory: (database: OperationDatabase) => RiskRepository): OperationActions {
  return { 'risk.cases.review': async (request, database) => {
    const access = requireAccess(request); const body = bodyRecord(request); const action = body.action;
    if (action !== 'accept' && action !== 'clear' && action !== 'confirm' && action !== 'close') throw new Error('RISK_CASE_ACTION_INVALID');
    const repository = factory(database); const current = await repository.riskCase(request.input.path.caseid!, access.scope.id);
    if (!current) throw new Error('RESOURCE_NOT_FOUND');
    const state = new RiskCase(current.id, current.state, current.actor).review(action, access.actor.id);
    const evidence = record(body.evidence ?? {});
    const reviewed = await repository.reviewCase({ id: current.id, scope: access.scope.id, state, reviewer: access.actor.id,
      reason: textField(body, 'reason', 1000), evidence, trace: access.trace });
    return { status: 200, body: reviewed };
  } };
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || JSON.stringify(value).length > 16_384) throw new Error('RISK_CASE_EVIDENCE_INVALID');
  return value as Readonly<Record<string, unknown>>;
}
