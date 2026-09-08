import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
import { SystemClock, type Clock } from '@shop/kernel';
import { DomainError } from '../../../../platform/error/DomainError';
import { Invitation, type InvitationState } from '../../domain/model/Invitation';
import { InvitationClaim } from '../../domain/model/InvitationClaim';
import { InvitationReceipt } from '../../domain/model/InvitationReceipt';
export class PgInvitationRedemption {
  protected readonly transactions = new PgTransactionAccess();
  constructor(protected readonly clock: Clock = new SystemClock()) {}
  async reserve(
    context: WriteTransactionContext,
    invitation: Invitation,
    input: Readonly<{
      claim: string;
      preauth: Buffer;
      browser: Buffer;
      device: Buffer;
      recipient: Buffer | null;
      principal: string | null;
      proof: 'otp' | 'sso' | 'terms';
      state: 'reserved' | 'proofpending';
      authorization: Readonly<{ stateHash: string; nonceHash: string; challenge: string }>;
      returnTarget: string;
    }>
  ): Promise<InvitationClaim> {
    const database = this.transactions.database(context);
    invitation.reserve(this.clock.now(), 0);
    const locked = await database.query(
      `select id from identity.invitation
      where id=$1 and status='active' and not_before<=clock_timestamp() and expires_at>clock_timestamp()
      for update`,
      [invitation.state.id]
    );
    if (!locked.rows[0]) throw new DomainError('INVITATION_INVALID');
    await database.query(
      `update identity.invitationclaim set state='expired',updated_at=clock_timestamp(),version=version+1
      where invitation_id=$1 and state in('reserved','proofpending','proved') and expires_at<=clock_timestamp()`,
      [invitation.state.id]
    );
    const claim = await database.query<{
      id: string;
      invitation_id: string;
      kind: InvitationState['kind'];
      target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier';
      recipient_hash: Buffer | null;
      state: 'reserved' | 'proofpending';
      proof_method: 'otp' | 'sso' | 'terms';
      expires_at: Date;
      proved_at: Date | null;
      version: number;
    }>(
      `insert into identity.invitationclaim(id,invitation_id,kind,browser_hash,device_hash,target,recipient_hash,state,proof_method,
      expires_at,created_at,updated_at,version)
      select $1,invitation.id,invitation.kind,$3,$4,$5,$6,$7,$8,clock_timestamp()+interval '5 minutes',
        clock_timestamp(),clock_timestamp(),1 from identity.invitation invitation where invitation.id=$2 and invitation.status='active'
        and invitation.not_before<=clock_timestamp() and invitation.expires_at>clock_timestamp()
        and invitation.use_count+(select count(*) from identity.invitationclaim open where open.invitation_id=invitation.id
          and open.state in('reserved','proofpending','proved') and open.expires_at>clock_timestamp())<invitation.max_uses
      returning id::text,invitation_id,kind,target,recipient_hash,state,proof_method,expires_at,proved_at,version`,
      [input.claim, invitation.state.id, input.browser, input.device, invitation.state.target, input.recipient, input.state, input.proof]
    );
    const row = claim.rows[0];
    if (!row) throw new DomainError('INVITATION_INVALID');
    await database.query(
      `insert into identity.preauth(id,transaction_id,principal_id,token_hash,candidate_hash,candidate_memberships,browser_hash,
      expires_at,created_at,purpose,target,reference_id,device_hash,state,version,
      auth_state_hash,auth_nonce_hash,auth_pkce_challenge,return_target)
      values($1,null,$2,$3,null,'[]'::jsonb,$4,
      clock_timestamp()+interval '5 minutes',clock_timestamp(),
      $5,$6,$7,$8,'active',0,$9,$10,$11,$12)`,
      [
        randomUUID(),
        input.principal,
        input.preauth,
        input.browser,
        invitation.state.kind === 'signin' ? 'invitationproof' : 'enrollment',
        invitation.state.target,
        input.claim,
        input.device,
        input.authorization.stateHash,
        input.authorization.nonceHash,
        input.authorization.challenge,
        input.returnTarget,
      ]
    );
    await new PgRuntimeWriter(database).append({
      id: `event:${randomUUID()}`,
      type: 'identity.invitation.reserved',
      aggregateType: 'invitation',
      aggregate: invitation.state.id,
      scope: invitation.state.organization,
      payload: { invitationId: invitation.state.id, target: invitation.state.target, kind: invitation.state.kind },
      trace: input.claim,
    });
    return new InvitationClaim({
      id: row.id,
      invitation: row.invitation_id,
      kind: row.kind,
      target: row.target,
      recipientHash: row.recipient_hash,
      state: row.state,
      proof: row.proof_method,
      expiresAt: row.expires_at,
      provedAt: row.proved_at,
      version: Number(row.version),
    });
  }
  async consume(
    context: WriteTransactionContext,
    invitation: Invitation,
    input: Readonly<{
      session: string | null;
      assurance: 1 | 2 | 3;
      trace: string;
      principal?: string;
      membership?: string;
    }>
  ): Promise<InvitationReceipt> {
    const database = this.transactions.database(context);
    const next = invitation.consume(this.clock.now());
    const consumed = await database.query(
      `update identity.invitation set use_count=$3,status=$4,version=$5,updated_at=clock_timestamp()
      where id=$1 and version=$2 and status='active' and use_count<max_uses and expires_at>clock_timestamp() returning id`,
      [invitation.state.id, invitation.state.version, next.state.useCount, next.state.status, next.state.version]
    );
    if (!consumed.rows[0]) throw new DomainError('INVITATION_INVALID');
    const receipt = await database.query<{
      id: string;
      invitation_id: string;
      principal_id: string;
      membership_id: string;
      session_id: string | null;
      assurance: 1 | 2 | 3;
      issuer_access_version: number;
      grant_digest: string;
      redeemed_at: Date;
      trace_id: string;
    }>(
      `insert into identity.invitationreceipt(id,invitation_id,principal_id,membership_id,session_id,assurance,
      issuer_access_version,grant_digest,redeemed_at,trace_id) values($1,$2,$3,$4,$5,$6,$7,$8,clock_timestamp(),$9)
      returning id::text,invitation_id,principal_id,membership_id,session_id,assurance,issuer_access_version,grant_digest,redeemed_at,trace_id`,
      [
        randomUUID(),
        invitation.state.id,
        input.principal ?? invitation.state.principal,
        input.membership ?? invitation.state.membership,
        input.session,
        input.assurance,
        invitation.state.issuerAccessVersion,
        invitation.state.grantDigest,
        input.trace,
      ]
    );
    const membership = input.membership ?? invitation.state.membership;
    await new PgRuntimeWriter(database).append({
      id: `event:${randomUUID()}`,
      type: 'identity.invitation.redeemed',
      aggregateType: 'invitation',
      aggregate: invitation.state.id,
      scope: invitation.state.organization,
      payload: { invitationId: invitation.state.id, membershipId: membership, target: invitation.state.target },
      trace: input.trace,
    });
    const row = receipt.rows[0];
    if (!row) throw new DomainError('INVITATION_INVALID');
    return new InvitationReceipt({
      id: row.id,
      invitation: row.invitation_id,
      principal: row.principal_id,
      membership: row.membership_id,
      session: row.session_id,
      assurance: Number(row.assurance) as 1 | 2 | 3,
      issuerAccessVersion: Number(row.issuer_access_version),
      grantDigest: row.grant_digest,
      redeemedAt: row.redeemed_at,
      trace: row.trace_id,
    });
  }
  async consumeClaim(context: WriteTransactionContext, claim: string, version: number): Promise<void> {
    const database = this.transactions.database(context);
    const result = await database.query(
      `update identity.invitationclaim set state='consumed',proved_at=coalesce(proved_at,clock_timestamp()),
      consumed_at=clock_timestamp(),updated_at=clock_timestamp(),version=version+1
      where id=$1 and version=$2 and state in('reserved','proofpending','proved') and expires_at>clock_timestamp() returning id`,
      [claim, version]
    );
    if (!result.rows[0]) throw new DomainError('PREAUTH_EXPIRED');
    await database.query(
      `update identity.preauth set state='consumed',consumed_at=clock_timestamp(),version=version+1
      where reference_id=$1 and state='active'`,
      [claim]
    );
  }
}
