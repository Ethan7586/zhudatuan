import { DomainError } from '../../../../platform/error/DomainError';
export class IdentityLink {
  constructor(
    readonly id: string,
    readonly provider: string,
    readonly principal: string,
    readonly status: 'active' | 'revoked',
    readonly version: number
  ) {
    if (!id || !provider || !principal || !Number.isSafeInteger(version) || version < 0) throw new DomainError('FEDERATION_LINK_CONFLICT');
    Object.freeze(this);
  }
}
