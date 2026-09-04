import { DomainError } from '../../../../foundation/domain/DomainError';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { AccessVersionPublisher } from './AccessVersionPublisher';

export interface ActivationGrant {
  readonly membership: string | null;
  readonly principal: string | null;
  readonly organization: string;
  readonly target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier';
  readonly issuerVersion: number;
  readonly digest: string;
}
export interface ActivationRequest {
  readonly issuerVersion: number;
  readonly membership: string;
  readonly principal: string;
  readonly organization: string;
  readonly target: 'storefront';
  readonly digest: string;
  readonly invitation: string;
  readonly trace: string;
}

export class ActivateMembership {
  constructor(private readonly versions: AccessVersionPublisher) {}

  async execute(context: WriteTransactionContext, input: ActivationRequest, grant: ActivationGrant): Promise<number> {
    if (
      grant.membership !== input.membership ||
      grant.principal !== input.principal ||
      grant.organization !== input.organization ||
      grant.target !== input.target ||
      grant.issuerVersion !== input.issuerVersion ||
      grant.digest !== input.digest
    ) {
      throw new DomainError('INVITATION_STALE');
    }
    return this.versions.activate(context, input.membership, input.trace, { invitation: input.invitation, target: input.target, grantDigest: input.digest });
  }
}
