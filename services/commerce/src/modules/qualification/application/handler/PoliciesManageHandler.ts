import { createHash } from 'node:crypto';
import { ContractJsonValueSchema, type OperationInputFor, type OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { QualificationRepository } from '../port/QualificationRepository';

export class PoliciesManageHandler implements OperationHandler<'qualification.policies.manage', 'write'> {
  readonly operation = 'qualification.policies.manage' as const;
  readonly mode = 'write' as const;

  constructor(private readonly qualifications: QualificationRepository) {}

  async execute(input: OperationInputFor<'qualification.policies.manage'>, context: WriteHandlerContext<'qualification.policies.manage'>): Promise<OperationReply<OperationOutputFor<'qualification.policies.manage'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const rule = ContractJsonValueSchema.parse(body.rule);
    const policy = await this.qualifications.savePolicy(context.transaction, {
      id: input.path.policyid,
      scope: access.scope.id,
      name: textField(body, 'name'),
      rule,
      hash: createHash('sha256').update(JSON.stringify(rule)).digest('hex'),
      actor: access.actor.id,
    });
    return { status: 200, body: policy };
  }
}
