import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';

import { ApplicationError } from '../../../../platform/error/ApplicationError';
import { DomainError } from '../../../../platform/error/DomainError';
import type { Invitation } from '../../domain/model/Invitation';
import { InvitationCode } from '../../domain/model/InvitationCode';
import type { InvitationRepository } from '../port/InvitationRepository';
import type { InvitationHashPort } from '../port/InvitationSecurity';

const DECOY = InvitationCode.issue(Buffer.alloc(24));
const EXPLAINABLE_STATES = new Set(['INVITATION_ACCEPTED', 'INVITATION_EXPIRED', 'INVITATION_REVOKED']);

export class InvitationLookup {
  constructor(
    private readonly repository: InvitationRepository,
    private readonly hasher: InvitationHashPort
  ) {}

  find(database: ReadTransactionContext, raw: unknown, target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier'): Promise<Invitation> {
    return this.resolve(raw, (hashes) => this.repository.find(database, hashes, target));
  }

  lock(database: WriteTransactionContext, raw: unknown, target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier'): Promise<Invitation> {
    return this.resolve(raw, (hashes) => this.repository.lock(database, hashes, target));
  }

  private async resolve(raw: unknown, lookup: (hashes: ReturnType<InvitationHashPort['candidates']>) => Promise<Invitation>): Promise<Invitation> {
    let valid = true;
    let code = DECOY;
    try {
      if (typeof raw !== 'string' || raw.length > 64) throw new DomainError('INVITATION_INVALID');
      code = InvitationCode.parse(raw);
    } catch {
      valid = false;
    }
    let invitation: Invitation;
    try {
      invitation = await lookup(this.hasher.candidates(code));
    } catch (cause) {
      if (cause instanceof DomainError && EXPLAINABLE_STATES.has(cause.code)) throw cause;
      if (cause instanceof ApplicationError) throw new DomainError('INVITATION_INVALID');
      throw cause;
    }
    if (!valid) throw new DomainError('INVITATION_INVALID');
    return invitation;
  }
}
