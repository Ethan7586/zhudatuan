import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { CommitContext, FinalizeContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { CustomerRepository, UpdateCustomerCommand } from '../port/CustomerRepository';
import type { ProtectCustomerData } from '../process/ProtectCustomerData';

export class CustomersUpdateHandler implements DurableOperationHandler<'partner.customers.update', UpdateCustomerCommand, OperationOutputFor<'partner.customers.update'>, 'write'> {
  readonly operation = 'partner.customers.update' as const;
  readonly mode = 'write' as const;

  constructor(
    private readonly customers: CustomerRepository,
    private readonly protector: ProtectCustomerData
  ) {}

  prepare(input: OperationInputFor<'partner.customers.update'>, context: PrepareContext<'partner.customers.update'>): Promise<UpdateCustomerCommand> {
    return this.protector.update(input, context);
  }

  async commit(_input: OperationInputFor<'partner.customers.update'>, prepared: UpdateCustomerCommand, context: CommitContext<'partner.customers.update'>) {
    const updated = await this.customers.update(context.transaction, prepared);
    if (updated === 'identifierconflict') throw new DomainError('PARTNER_CUSTOMER_IDENTIFIER_CONFLICT');
    if (updated === 'notfound') throw new DomainError('RESOURCE_NOT_FOUND');
    if (updated === 'versionconflict') throw new DomainError('VERSION_CONFLICT');
    const response = { status: 200, body: updated as OperationOutputFor<'partner.customers.update'>, headers: { etag: `"${updated.version}"` } } as const;
    return Object.freeze({ checkpoint: response.body, response });
  }

  finalize(_input: OperationInputFor<'partner.customers.update'>, checkpoint: OperationOutputFor<'partner.customers.update'>, _context: FinalizeContext<'partner.customers.update'>): Promise<OperationReply<OperationOutputFor<'partner.customers.update'>>> {
    return Promise.resolve({ status: 200, body: checkpoint, headers: { etag: `"${checkpoint.version}"` } });
  }
}
