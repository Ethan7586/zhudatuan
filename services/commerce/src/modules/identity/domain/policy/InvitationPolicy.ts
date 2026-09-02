import { DomainError } from '../../../../foundation/domain/DomainError';
import type { InvitationKind, InvitationTarget } from '../model/Invitation';

export class InvitationPolicy {
  issue(
    input: Readonly<{ kind: InvitationKind; target: InvitationTarget; membership: string | null; principal: string | null; recipientHash: Buffer | null; maxUses: number; assurance: number; reason: string; expiresAt: Date }>,
    now: Date
  ): void {
    if (input.reason.trim().length < 4 || input.reason.length > 1000) throw new DomainError('VALIDATION_FAILED', { field: 'reason' });
    if (input.expiresAt.getTime() <= now.getTime() + 10 * 60_000 || input.expiresAt.getTime() > now.getTime() + 90 * 86_400_000) {
      throw new DomainError('VALIDATION_FAILED', { field: 'expiresAt' });
    }
    if (input.kind === 'signin' && (!input.membership || !input.principal || input.maxUses !== 1)) throw new DomainError('VALIDATION_FAILED', { field: 'kind' });
    if (input.kind === 'enrollment' && (!input.membership || input.principal || !input.recipientHash || input.maxUses !== 1 || input.target !== 'storefront')) throw new DomainError('VALIDATION_FAILED', { field: 'kind' });
    if (input.kind === 'campaign' && (input.target !== 'storefront' || input.membership || input.principal)) throw new DomainError('VALIDATION_FAILED', { field: 'kind' });
    if (input.target === 'console' && (input.kind !== 'signin' || !input.recipientHash || input.assurance < 2)) throw new DomainError('PROOF_REQUIRED');
  }
}
