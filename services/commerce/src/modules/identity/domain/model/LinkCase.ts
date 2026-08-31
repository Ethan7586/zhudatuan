import { DomainError } from '../../../../foundation/domain/DomainError';
export type LinkCaseReason = 'unlinked' | 'ambiguous' | 'principalconflict' | 'tenantunknown' | 'subjectconflict';
export class LinkCase {
  constructor(
    readonly id: string,
    readonly reason: LinkCaseReason,
    readonly status: 'open' | 'verified' | 'rejected' | 'expired',
    readonly decisionby: string | null,
    readonly checkedby: string | null,
    readonly version: number
  ) {
    if (!/^[0-9a-f-]{36}$/.test(id) || (decisionby !== null && decisionby === checkedby) || !Number.isSafeInteger(version) || version < 0) {
      throw new DomainError('FEDERATION_LINK_CONFLICT');
    }
    Object.freeze(this);
  }
  decide(status: 'verified' | 'rejected', actor: string, checker: string | null): LinkCase {
    if (this.status !== 'open' || !actor || checker === actor) throw new DomainError('FEDERATION_LINK_CONFLICT');
    return new LinkCase(this.id, this.reason, status, actor, checker, this.version + 1);
  }
}
