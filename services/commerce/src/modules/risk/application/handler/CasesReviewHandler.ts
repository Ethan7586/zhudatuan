import { randomUUID } from 'node:crypto';
import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { domainEvent } from '@shop/kernel';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { RiskCase } from '../../domain/model/RiskCase';
import type { RiskAdministrationRepository } from '../port/RiskAdministrationRepository';

export class CasesReviewHandler implements OperationHandler<'risk.cases.review', 'write'> {
  readonly operation = 'risk.cases.review' as const;
  readonly mode = 'write' as const;

  constructor(private readonly risks: RiskAdministrationRepository) {}

  async execute(input: OperationInputFor<'risk.cases.review'>, context: WriteHandlerContext<'risk.cases.review'>): Promise<OperationReply<OperationOutputFor<'risk.cases.review'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const action = body.action;
    if (action !== 'accept' && action !== 'clear' && action !== 'confirm' && action !== 'close') throw new Error('RISK_CASE_ACTION_INVALID');
    const current = await this.risks.riskCase(context.transaction, input.path.caseid, access.scope.id);
    if (!current) throw new DomainError('RESOURCE_NOT_FOUND');
    const state = new RiskCase(current.id, current.state, current.actor).review(action, access.actor.id);
    const evidence = evidenceRecord(body.evidence ?? {});
    const reviewed = await this.risks.reviewCase(context.transaction, {
      id: current.id,
      scope: access.scope.id,
      state,
      reviewer: access.actor.id,
      reason: textField(body, 'reason', 1000),
      evidence,
    });
    const terminal = state === 'cleared' || state === 'confirmed' || state === 'closed';
    const events = terminal
      ? [
          domainEvent({
            event: `event:${randomUUID()}`,
            type: 'risk.case.resolved',
            version: 1,
            aggregate: { type: 'riskcase', id: current.id, version: 1 },
            tenant: access.scope.tenant ?? access.scope.id,
            actor: access.actor.id,
            occurred: new Date().toISOString(),
            trace: context.traceId,
            payload: { case: current.id, state },
          }),
        ]
      : [];
    return { status: 200, body: reviewed as OperationOutputFor<'risk.cases.review'>, events };
  }
}

function evidenceRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value) || JSON.stringify(value).length > 16_384) throw new Error('RISK_CASE_EVIDENCE_INVALID');
  return value as Readonly<Record<string, unknown>>;
}
