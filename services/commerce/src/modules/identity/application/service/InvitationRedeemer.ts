import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { requireWriteTransaction } from '../../../../foundation/persistence/TransactionContext';

import type { InvitationAccessPort } from '../../../access/public';
import type { Invitation } from '../../domain/model/Invitation';
import type { InvitationReceipt } from '../../domain/model/InvitationReceipt';
import type { InvitationRepository } from '../port/InvitationRepository';
import type { Telemetry } from '@shop/telemetry';
import { DomainError } from '../../../../foundation/domain/DomainError';

export class InvitationRedeemer {
  constructor(
    private readonly repository: InvitationRepository,
    private readonly access: InvitationAccessPort,
    private readonly telemetry: Telemetry
  ) {}

  validate(database: ReadTransactionContext, invitation: Invitation, target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier'): Promise<void> {
    const state = invitation.state;
    if (!state.membership || state.kind === 'campaign') throw new Error('INVITATION_MEMBERSHIP_MISSING');
    return this.access.validate(database, {
      kind: state.kind,
      issuer: state.issuer,
      issuerAccessVersion: state.issuerAccessVersion,
      membership: state.membership,
      grantDigest: state.grantDigest,
      organization: state.organization,
      target,
      policy: state.policy,
      termsHash: state.termsHash,
      expiresAt: state.expiresAt,
    });
  }

  async consume(
    database: WriteTransactionContext,
    invitation: Invitation,
    input: Readonly<{ session: string | null; assurance: 1 | 2 | 3; trace: string; claim?: Readonly<{ id: string; version: number }>; principal?: string; membership?: string }>
  ): Promise<InvitationReceipt> {
    const started = performance.now();
    const base = { requestId: input.trace, traceId: input.trace, module: 'identity', operation: 'identity.invitation.redeem', resourceType: invitation.state.kind };
    try {
      const receipt = await this.repository.consume(requireWriteTransaction(database), invitation, {
        session: input.session,
        assurance: input.assurance,
        trace: input.trace,
        ...(input.principal === undefined ? {} : { principal: input.principal }),
        ...(input.membership === undefined ? {} : { membership: input.membership }),
      });
      if (input.claim) await this.repository.consumeClaim(database, input.claim.id, input.claim.version);
      this.telemetry.metrics.count('identity_invitation_redeem_total', 1, { ...base, result: 'success' });
      if (input.session !== null) this.telemetry.metrics.count('identity_session_created_total', 1, { ...base, result: 'success', provider: 'invitation', target: invitation.state.target });
      return receipt;
    } catch (cause) {
      const errorCode = cause instanceof DomainError ? cause.code : 'INVITATION_REDEEM_FAILED';
      this.telemetry.metrics.count('identity_invitation_redeem_total', 1, { ...base, result: 'failure', errorCode });
      this.telemetry.metrics.count('identity_invitation_failure_total', 1, { ...base, result: 'failure', errorCode });
      if (errorCode === 'PREAUTH_EXPIRED' || errorCode === 'INVITATION_INVALID') {
        this.telemetry.metrics.count('identity_invitation_replay_total', 1, { ...base, result: 'denied', errorCode });
      }
      throw cause;
    } finally {
      this.telemetry.metrics.duration('identity_invitation_redeem_duration_ms', performance.now() - started, base);
    }
  }
}
