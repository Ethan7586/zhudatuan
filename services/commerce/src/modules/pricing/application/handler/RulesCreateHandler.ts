import { randomUUID } from 'node:crypto';
import { ContractJsonValueSchema, type OperationInputFor, type OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, integerField } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { RuleRepository } from '../port/RuleRepository';

export class RulesCreateHandler implements OperationHandler<'pricing.rules.create', 'write'> {
  readonly operation = 'pricing.rules.create' as const;
  readonly mode = 'write' as const;

  constructor(private readonly rules: RuleRepository) {}

  async execute(input: OperationInputFor<'pricing.rules.create'>, context: WriteHandlerContext<'pricing.rules.create'>): Promise<OperationReply<OperationOutputFor<'pricing.rules.create'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const rule = await this.rules.create(context.transaction, {
      id: `rule:${randomUUID()}`,
      scope: access.scope.id,
      priority: integerField(body, 'priority'),
      kind: typeof body.kind === 'string' ? body.kind : 'markup',
      condition: ContractJsonValueSchema.parse(body.condition ?? {}),
      effect: ContractJsonValueSchema.parse(body.effect ?? {}),
    });
    return { status: 201, body: rule };
  }
}
