import { randomUUID } from 'node:crypto';
import { ContractJsonValueSchema, type OperationInputFor, type OperationOutputFor } from '@shop/contract';
import { domainEvent } from '@shop/kernel';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { JobScheduler } from '../../../../foundation/application/JobScheduler';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, integerField, textField } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { RiskPolicy } from '../../domain/model/RiskPolicy';
import type { RiskAdministrationRepository } from '../port/RiskAdministrationRepository';

export class PoliciesManageHandler implements OperationHandler<'risk.policies.manage', 'write'> {
  readonly operation = 'risk.policies.manage' as const;
  readonly mode = 'write' as const;

  constructor(
    private readonly risks: RiskAdministrationRepository,
    private readonly jobs: JobScheduler
  ) {}

  async execute(input: OperationInputFor<'risk.policies.manage'>, context: WriteHandlerContext<'risk.policies.manage'>): Promise<OperationReply<OperationOutputFor<'risk.policies.manage'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const action = body.action;
    const id = input.path.policyid;
    if (action === 'activate') {
      const version = integerField(body, 'version', 1);
      const rollout = percent(body.rolloutPercent, 100);
      const policy = await this.risks.activatePolicy(context.transaction, { id, scope: access.scope.id, version, rolloutPercent: rollout, actor: access.actor.id });
      return {
        status: 200,
        body: policy as OperationOutputFor<'risk.policies.manage'>,
        events: [event('risk.policy.activated', id, version, access, context.traceId, { policy: id, version, rolloutPercent: rollout })],
      };
    }
    if (action === 'retire') {
      const policy = await this.risks.retirePolicy(context.transaction, id, access.scope.id);
      return { status: 200, body: policy as OperationOutputFor<'risk.policies.manage'> };
    }
    if (action !== 'save') throw new Error('RISK_POLICY_ACTION_INVALID');
    const rollout = percent(body.rolloutPercent, 100);
    const policy = new RiskPolicy(id, 1, ContractJsonValueSchema.parse(body.rule), rollout);
    const saved = await this.risks.savePolicy(context.transaction, {
      id,
      scope: access.scope.id,
      name: textField(body, 'name'),
      rule: ContractJsonValueSchema.parse(policy.rule),
      ruleHash: policy.hash,
      rolloutPercent: rollout,
      actor: access.actor.id,
    });
    const candidate = Reflect.get(saved, 'candidate_version');
    if (!Number.isSafeInteger(candidate)) throw new Error('RISK_POLICY_VERSION_MISSING');
    await this.jobs.schedule(context.transaction, {
      id: `job:${randomUUID()}`,
      kind: 'riskscan',
      owner: 'risk',
      scope: access.scope.id,
      payload: { policy: id, version: candidate as number },
      priority: 20,
    });
    return { status: 202, body: saved as OperationOutputFor<'risk.policies.manage'> };
  }
}

function percent(value: unknown, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 100) throw new Error('RISK_ROLLOUT_INVALID');
  return value as number;
}

function event(type: string, id: string, version: number, access: ReturnType<typeof requireSession>, trace: string, payload: Readonly<Record<string, unknown>>) {
  return domainEvent({
    event: `event:${randomUUID()}`,
    type,
    version: 1,
    aggregate: { type: 'riskpolicy', id, version },
    tenant: access.scope.tenant ?? access.scope.id,
    actor: access.actor.id,
    occurred: new Date().toISOString(),
    trace,
    payload,
  });
}
