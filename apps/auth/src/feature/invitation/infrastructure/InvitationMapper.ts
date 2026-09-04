import type { OperationOutputFor } from '@shop/contract';
import { TransportError } from '@shop/sdk';
import type { InvitationOutcome } from '../model/Invitation';
import { challengeState } from '../../challenge';

export function mapInvitation(result: Exclude<OperationOutputFor<'identity.invitations.resolve'>, { kind: 'session' }>): InvitationOutcome {
  if (result.kind === 'enrollment') return Object.freeze({ kind: 'enrollment', id: result.enrollment.id, expiresAt: result.enrollment.expiresAt, target: result.enrollment.target });
  if (result.kind === 'proofRequired' && result.proof.reference) {
    const challenge = challengeState({ id: result.proof.reference, purpose: result.proof.purpose, expiresAt: result.proof.expiresAt, retryAt: result.proof.retryAt, attemptsRemaining: result.proof.attemptsRemaining }, 'invitation_login');
    if (challenge !== undefined) return Object.freeze({ kind: 'proof', reference: result.proof.reference, expiresAt: result.proof.expiresAt, method: result.proof.method, target: result.proof.target, challenge });
  }
  throw new TransportError('CONTRACT_INVALID', undefined, false);
}
