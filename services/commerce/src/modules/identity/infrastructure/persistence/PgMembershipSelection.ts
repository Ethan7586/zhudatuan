import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

import { DomainError } from '../../../../foundation/domain/DomainError';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { MembershipSelectionPort, MembershipSelectionValue } from '../../application/port/MembershipSelectionPort';
interface SelectionRow {
  readonly id: string;
  readonly transaction_id: string | null;
  readonly principal_id: string;
  readonly target: 'console' | 'storefront';
  readonly candidate_memberships: readonly Readonly<{
    id: string;
    target: 'console' | 'storefront';
    accessVersion: number;
    displayName: string;
    organizationName: string;
    scopeKind: string;
    scopeId: string;
    roleLabel: string;
    logoUrl: string | null;
  }>[];
  readonly expires_at: Date;
  readonly auth_state_hash: string;
  readonly auth_nonce_hash: string;
  readonly auth_pkce_challenge: string;
  readonly assurance: number;
  readonly return_target: string | null;
}
export class PgMembershipSelection implements MembershipSelectionPort {
  private readonly transactions = new PgTransactionAccess();
  async create(
    context: WriteTransactionContext,
    input: Omit<MembershipSelectionValue, 'id' | 'expiresAt' | 'transaction'> &
      Readonly<{
        browser: Buffer;
        device: Buffer;
      }>
  ) {
    const database = this.transactions.database(context);
    const id = randomUUID();
    const token = randomBytes(48).toString('base64url');
    const candidates = JSON.stringify(input.memberships);
    await database.query(
      `insert into identity.preauth(id,transaction_id,principal_id,token_hash,candidate_hash,candidate_memberships,
      browser_hash,expires_at,created_at,purpose,target,reference_id,device_hash,state,version,auth_state_hash,auth_nonce_hash,
      auth_pkce_challenge,assurance,return_target) values($1::uuid,null,$2,$3,$4,$5::jsonb,$6,clock_timestamp()+interval '5 minutes',clock_timestamp(),
      'federationselection',$7,$1::uuid::text,$8,'active',0,$9,$10,$11,$12,$13)`,
      [
        id,
        input.principal,
        hash(token),
        hash(candidates),
        candidates,
        input.browser,
        input.target,
        input.device,
        input.authorization.stateHash,
        input.authorization.nonceHash,
        input.authorization.challenge,
        input.assurance,
        input.returnTarget,
      ]
    );
    return Object.freeze({ id, token });
  }
  async read(context: ReadTransactionContext, id: string): Promise<MembershipSelectionValue> {
    const database = this.transactions.database(context);
    const result = await database.query<SelectionRow>(
      `select id::text,transaction_id::text,principal_id,target,candidate_memberships,
      expires_at,auth_state_hash,auth_nonce_hash,auth_pkce_challenge,assurance,return_target from identity.preauth where id=$1::uuid
      and purpose='federationselection' and state='active' and consumed_at is null and expires_at>clock_timestamp()`,
      [id]
    );
    return selection(result.rows[0]);
  }
  async consume(context: WriteTransactionContext, id: string, browser: Buffer, device: Buffer, membership: string): Promise<MembershipSelectionValue> {
    const database = this.transactions.database(context);
    const current = await this.read(context, id);
    if (!current.memberships.some((candidate) => candidate.id === membership && candidate.target === current.target)) {
      throw new DomainError('MEMBERSHIP_SELECTION_REQUIRED');
    }
    const result = await database.query<SelectionRow>(
      `update identity.preauth set state='consumed',consumed_at=clock_timestamp(),version=version+1
      where id=$1::uuid and browser_hash=$2 and device_hash=$3 and state='active' and consumed_at is null
        and expires_at>clock_timestamp() returning id::text,transaction_id::text,principal_id,target,candidate_memberships,
        expires_at,auth_state_hash,auth_nonce_hash,auth_pkce_challenge,assurance,return_target`,
      [id, browser, device]
    );
    return selection(result.rows[0]);
  }
}
function selection(row: SelectionRow | undefined): MembershipSelectionValue {
  if (!row) throw new DomainError('FEDERATION_TRANSACTION_EXPIRED');
  if (!row.return_target) throw new DomainError('FEDERATION_TRANSACTION_INVALID');
  return Object.freeze({
    id: row.id,
    principal: row.principal_id,
    target: row.target,
    memberships: Object.freeze(row.candidate_memberships.map((candidate) => Object.freeze(candidate))),
    expiresAt: row.expires_at,
    transaction: row.transaction_id,
    returnTarget: row.return_target,
    assurance: Number(row.assurance),
    authorization: Object.freeze({
      stateHash: row.auth_state_hash,
      nonceHash: row.auth_nonce_hash,
      challenge: row.auth_pkce_challenge,
    }),
  });
}
function hash(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
