import { randomUUID } from 'node:crypto';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { SystemClock, type Clock } from '../../../../foundation/domain/Clock';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { Invitation, type InvitationState } from '../../domain/model/Invitation';
import { InvitationClaim } from '../../domain/model/InvitationClaim';
import { InvitationReceipt } from '../../domain/model/InvitationReceipt';

export class PgInvitationRedemption {
  constructor(protected readonly clock: Clock = SystemClock) {}

  async reserve(
    database: OperationDatabase,
    invitation: Invitation,
    input: Readonly<{ claim: string; preauth: Buffer; browser: Buffer; device: Buffer; recipient: Buffer | null; principal: string | null; proof: 'otp' | 'sso' | 'terms' }>
  ): Promise<InvitationClaim> {
    invitation.reserve(this.clock.now(), 0);
    await database.query(
      `update identity.invitationclaim set state='expired',updated_at=clock_timestamp(),version=version+1
      where invitation_id=$1 and state in('reserved','proofpending','proved') and expires_at<=clock_timestamp()`,
      [invitation.state.id]
    );
    const claim = await database.query<{
      id: string;
      invitation_id: string;
      kind: InvitationState['kind'];
      target: 'console' | 'storefront';
      recipient_hash: Buffer | null;
      state: 'proofpending';
      proof_method: 'otp' | 'sso' | 'terms';
      expires_at: Date;
      proved_at: Date | null;
      version: number;
    }>(
      `insert into identity.invitationclaim(id,invitation_id,kind,browser_hash,device_hash,target,recipient_hash,state,proof_method,
      expires_at,created_at,updated_at,version)
      select $1,invitation.id,invitation.kind,$3,$4,$5,$6,'proofpending',$7,clock_timestamp()+interval '5 minutes',
        clock_timestamp(),clock_timestamp(),1 from identity.invitation invitation where invitation.id=$2 and invitation.status='active'
        and invitation.use_count+(select count(*) from identity.invitationclaim open where open.invitation_id=invitation.id
          and open.state in('reserved','proofpending','proved') and open.expires_at>clock_timestamp())<invitation.max_uses
      returning id::text,invitation_id,kind,target,recipient_hash,state,proof_method,expires_at,proved_at,version`,
      [input.claim, invitation.state.id, input.browser, input.device, invitation.state.target, input.recipient, input.proof]
    );
    const row = claim.rows[0];
    if (!row) throw new DomainError('INVITATION_INVALID');
    await database.query(
      `insert into identity.preauth(id,transaction_id,principal_id,token_hash,candidate_hash,candidate_memberships,browser_hash,
      expires_at,created_at,purpose,target,reference_id,device_hash,state,version)
      values($1,null,$2,$3,null,'[]'::jsonb,$4,
      clock_timestamp()+interval '5 minutes',clock_timestamp(),
      $5,$6,$7,$8,'active',0)`,
      [randomUUID(), input.principal, input.preauth, input.browser, invitation.state.kind === 'signin' ? 'invitationproof' : 'enrollment', invitation.state.target, input.claim, input.device]
    );
    await database.query(
      `insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,
      occurred_at,available_at) values($1,'identity.invitation.reserved',1,'invitation',$2,$3,
      jsonb_build_object('invitationId',$2::text,'target',$4::text,'kind',$5::text),$6,clock_timestamp(),clock_timestamp())`,
      [`event:${randomUUID()}`, invitation.state.id, invitation.state.organization, invitation.state.target, invitation.state.kind, input.claim]
    );
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

  async consume(database: OperationDatabase, invitation: Invitation, input: Readonly<{ session: string | null; assurance: 1 | 2 | 3; trace: string; principal?: string; membership?: string }>): Promise<InvitationReceipt> {
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
    await database.query(
      `insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
      values($1,'identity.invitation.redeemed',1,'invitation',$2,$3,jsonb_build_object('invitationId',$2::text,'membershipId',$4::text,'target',$5::text),
      $6,clock_timestamp(),clock_timestamp())`,
      [`event:${randomUUID()}`, invitation.state.id, invitation.state.organization, input.membership ?? invitation.state.membership, invitation.state.target, input.trace]
    );
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

  async consumeClaim(database: OperationDatabase, claim: string, version: number): Promise<void> {
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
