import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { DomainError } from '../../../../platform/error/DomainError';
import type { CommitContext, FinalizeContext, PrepareContext } from '../../../../pipeline/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { CreateCustomerCommand, CustomerRepository } from '../port/CustomerRepository';
import type { ProtectCustomerData } from '../process/ProtectCustomerData';

export class CustomersCreateHandler implements DurableOperationHandler<'partner.customers.create', CreateCustomerCommand, OperationOutputFor<'partner.customers.create'>, 'write'> {
  readonly operation = 'partner.customers.create' as const;
  readonly mode = 'write' as const;

  constructor(
    private readonly customers: CustomerRepository,
    private readonly protector: ProtectCustomerData
  ) {}

  prepare(input: OperationInputFor<'partner.customers.create'>, context: PrepareContext<'partner.customers.create'>): Promise<CreateCustomerCommand> {
    return this.protector.create(input, context);
  }

  async commit(_input: OperationInputFor<'partner.customers.create'>, prepared: CreateCustomerCommand, context: CommitContext<'partner.customers.create'>) {
    const created = await this.customers.create(context.transaction, prepared);
    if (created === 'identifierconflict') throw new DomainError('PARTNER_CUSTOMER_IDENTIFIER_CONFLICT');
    const response = { status: 201, body: created as OperationOutputFor<'partner.customers.create'>, headers: { etag: `"${created.version}"` } } as const;
    return Object.freeze({ checkpoint: response.body, response });
  }

  finalize(
    _input: OperationInputFor<'partner.customers.create'>,
    checkpoint: OperationOutputFor<'partner.customers.create'>,
    _context: FinalizeContext<'partner.customers.create'>
  ): Promise<OperationReply<OperationOutputFor<'partner.customers.create'>>> {
    return Promise.resolve({ status: 201, body: checkpoint, headers: { etag: `"${checkpoint.version}"` } });
  }
}
