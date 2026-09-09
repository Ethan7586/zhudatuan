import { NETWORK_CATALOG } from '@shop/config/networkcatalog';
import type { OperationTarget } from '@shop/contract';

import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import { DomainError } from '../../../../platform/error/DomainError';
import type { IdentityExperiencePort } from '../../../experience/public';
import type { ReturnTargetPort, SignedReturnTarget } from '../port/ReturnTargetPort';
import { returnDestination } from './ReturnDestination';

export class MembershipDestination {
  constructor(
    private readonly returns: ReturnTargetPort,
    private readonly experience: IdentityExperiencePort
  ) {}

  async resolve(context: ReadTransactionContext, input: Readonly<{ target: OperationTarget; returnTarget: unknown; organization: string }>): Promise<SignedReturnTarget> {
    const destination = returnDestination(this.returns, input.target, input.returnTarget);
    if (input.target !== 'storefront' || !isRoot(destination.url)) return destination;
    const storefront = await this.experience.storefront(context, input.organization);
    if (!storefront) throw new DomainError('MEMBERSHIP_INACTIVE');
    return this.returns.issue('storefront', {
      path: `${NETWORK_CATALOG.storefront.entryPath}/${storefront.handle}`,
      ...(destination.tenant === undefined ? {} : { tenant: destination.tenant }),
    });
  }
}

function isRoot(value: string): boolean {
  const destination = new URL(value);
  return destination.pathname === '/' && destination.search === '' && destination.hash === '';
}
