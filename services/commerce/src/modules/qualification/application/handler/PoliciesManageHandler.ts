import { ContractJsonValueSchema, type OperationInputFor, type OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { bodyRecord, integerField, textField } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { QualificationRule } from '../../domain/model/QualificationRule';
import type { QualificationRepository } from '../port/QualificationRepository';

export class PoliciesManageHandler implements OperationHandler<'qualification.policies.manage', 'write'> {
  readonly operation = 'qualification.policies.manage' as const;
  readonly mode = 'write' as const;

  constructor(private readonly qualifications: QualificationRepository) {}

  async execute(input: OperationInputFor<'qualification.policies.manage'>, context: WriteHandlerContext<'qualification.policies.manage'>): Promise<OperationReply<OperationOutputFor<'qualification.policies.manage'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    if (context.expectedVersion === undefined) throw new DomainError('EXPECTED_VERSION_REQUIRED');
    const shared = { id: input.path.policyid, scope: access.scope.id, actor: access.actor.id, expectedVersion: context.expectedVersion } as const;
    const policy =
      body.action === 'publish'
        ? await this.publish(body, shared, context)
        : body.action === 'rollback'
          ? await this.qualifications.rollbackPolicy(context.transaction, { ...shared, version: integerField(body, 'version', 1) })
          : null;
    if (!policy) throw new DomainError('VERSION_CONFLICT');
    return { status: 200, body: policy };
  }

  private async publish(
    body: Readonly<Record<string, unknown>>,
    shared: Readonly<{ id: string; scope: string; actor: string; expectedVersion: number }>,
    context: WriteHandlerContext<'qualification.policies.manage'>
  ) {
    const rule = new QualificationRule(ContractJsonValueSchema.parse(body.rule));
    return this.qualifications.publishPolicy(context.transaction, { ...shared, name: textField(body, 'name'), rule: rule.value, hash: rule.hash });
  }
}
