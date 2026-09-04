import type { OperationId, OperationInputFor, OperationOutputFor } from '@shop/contract';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import { bodyRecord, textField } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { Customer, type CustomerState } from '../../domain/model/Customer';
import type { CustomerRepository } from '../port/CustomerRepository';

type StateOperation = Extract<OperationId, 'partner.customers.enable' | 'partner.customers.disable'>;

export class ChangeCustomerState {
  constructor(private readonly customers: CustomerRepository) {}

  async execute<TKey extends StateOperation>(input: OperationInputFor<TKey>, context: WriteHandlerContext<TKey>, target: Extract<CustomerState, 'active' | 'disabled'>): Promise<OperationOutputFor<TKey>> {
    const access = requireSession(context.security);
    textField(bodyRecord(input), 'reason', 500);
    if (!Number.isSafeInteger(context.expectedVersion) || context.expectedVersion! < 1) throw new DomainError('EXPECTED_VERSION_REQUIRED');
    const current = await this.customers.lock(context.transaction, access.scope.id, input.path.customerid);
    if (!current) throw new DomainError('RESOURCE_NOT_FOUND');
    if (current.version !== context.expectedVersion) throw new DomainError('VERSION_CONFLICT');
    const customer = new Customer(current.id, current.kind, current.name, current.status, current.version);
    const state = target === 'active' ? customer.enable(current.agreementEffective) : customer.disable();
    const updated = await this.customers.setState(context.transaction, {
      scope: access.scope.id,
      id: current.id,
      current: current.status,
      target: state,
      actor: access.membership.id,
      expectedVersion: context.expectedVersion!,
    });
    if (!updated) throw new DomainError('VERSION_CONFLICT');
    return updated as OperationOutputFor<TKey>;
  }
}
