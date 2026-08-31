import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { ApplicationError } from '../../../../foundation/domain/ApplicationError';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { Invitation } from '../../domain/model/Invitation';
import { InvitationCode } from '../../domain/model/InvitationCode';
import type { InvitationRepository } from '../port/InvitationRepository';
import type { InvitationHashPort } from '../port/InvitationSecurity';

const DECOY = InvitationCode.issue(Buffer.alloc(20));

export class InvitationLookup {
  constructor(
    private readonly repository: InvitationRepository,
    private readonly hasher: InvitationHashPort
  ) {}

  async find(database: OperationDatabase, raw: unknown, target: 'console' | 'storefront', lock: boolean): Promise<Invitation> {
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
      invitation = await this.repository.find(database, this.hasher.candidates(code), target, lock);
    } catch (cause) {
      if (cause instanceof ApplicationError) throw new DomainError('INVITATION_INVALID');
      throw cause;
    }
    if (!valid) throw new DomainError('INVITATION_INVALID');
    return invitation;
  }
}
