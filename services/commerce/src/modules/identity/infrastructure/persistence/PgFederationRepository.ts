import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import { DomainError } from '../../../../platform/error/DomainError';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { CreateFederation, FederationCallbackRecord, FederationRepository, FederationResolution } from '../../application/port/FederationRepository';
import type { FederatedSubject } from '../../domain/model/FederatedSubject';
import { FederationTransaction } from '../../domain/model/FederationTransaction';
import type { IdentityMemberPort } from '../../../member/public';
import type { IdentityAccessPort } from '../../../access/public';
import type { AuthTicketBinding } from '../../application/port/AuthTicketPort';
import { membershipCandidate } from '../../application/model/MembershipCandidate';
interface TransactionRow {
  readonly id: string;
  readonly provider_id: string;
  readonly status: FederationTransaction['state'];
  readonly version: number;
  readonly expires_at: Date;
  readonly target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier';
  readonly purpose: 'signin' | 'link';
  readonly link_principal_id: string | null;
  readonly link_membership_id: string | null;
}
interface CallbackRow extends TransactionRow {
  readonly nonce_hash: Buffer;
  readonly verifier_ciphertext: string;
  readonly return_target_ref: string;
  readonly browser_hash: Buffer;
  readonly auth_state_hash: string;
  readonly auth_nonce_hash: string;
  readonly auth_pkce_challenge: string;
}
export class PgFederationRepository implements FederationRepository {
  private readonly transactions = new PgTransactionAccess();
  constructor(
    private readonly members: IdentityMemberPort,
    private readonly access: IdentityAccessPort
  ) {}
  async create(context: WriteTransactionContext, value: CreateFederation): Promise<FederationTransaction> {
    const database = this.transactions.database(context);
    const id = randomUUID();
    const result = await database.query<TransactionRow>(
      `insert into identity.federationtransaction(id,provider_id,state_hash,nonce_hash,pkce_challenge,
        verifier_ciphertext,browser_hash,return_target_hash,return_target_ref,target,risk_hash,auth_state_hash,auth_nonce_hash,
        auth_pkce_challenge,purpose,link_principal_id,link_membership_id,status,version,expires_at,created_at,updated_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'created',0,$18,clock_timestamp(),clock_timestamp())
      returning id,provider_id,status,version,expires_at,target,purpose,link_principal_id,link_membership_id`,
      [
        id,
        value.provider,
        value.statehash,
        value.noncehash,
        value.challenge,
        value.verifier,
        value.browserhash,
        value.returntargethash,
        value.returntarget,
        value.target,
        value.riskhash,
        value.authorization.stateHash,
        value.authorization.nonceHash,
        value.authorization.challenge,
        value.purpose,
        value.principal,
        value.membership,
        value.expiresat,
      ]
    );
    return transaction(result.rows[0]);
  }
  async redirected(context: WriteTransactionContext, value: FederationTransaction): Promise<FederationTransaction> {
    const database = this.transactions.database(context);
    const next = value.transition('redirected', new Date());
    await transition(database, next, value.version);
    return next;
  }
  async pending(context: ReadTransactionContext, provider: string, statehash: Buffer): Promise<FederationCallbackRecord> {
    const database = this.transactions.database(context);
    const result = await database.query<CallbackRow>(
      `select id,provider_id,status,version,expires_at,target,purpose,link_principal_id,link_membership_id,nonce_hash,verifier_ciphertext,
        return_target_ref,browser_hash,auth_state_hash,auth_nonce_hash,auth_pkce_challenge
      from identity.federationtransaction where provider_id=$1 and state_hash=$2 and status='redirected' and consumed_at is null
        and expires_at>clock_timestamp()`,
      [provider, statehash]
    );
    const accepted = result.rows[0];
    if (accepted)
      return Object.freeze({
        transaction: transaction(accepted),
        noncehash: accepted.nonce_hash,
        verifierciphertext: accepted.verifier_ciphertext,
        returntarget: accepted.return_target_ref,
        browserhash: accepted.browser_hash,
        authorization: Object.freeze({ stateHash: accepted.auth_state_hash, nonceHash: accepted.auth_nonce_hash, challenge: accepted.auth_pkce_challenge }),
      });
    const existing = await database.query<{
      status: string;
      expires_at: Date;
      consumed_at: Date | null;
    }>('select status,expires_at,consumed_at from identity.federationtransaction where provider_id=$1 and state_hash=$2', [provider, statehash]);
    const row = existing.rows[0];
    if (row?.consumed_at || row?.status === 'completed') throw new DomainError('FEDERATION_TRANSACTION_CONSUMED');
    if (row && row.expires_at <= new Date()) throw new DomainError('FEDERATION_TRANSACTION_EXPIRED');
    throw new DomainError('FEDERATION_TRANSACTION_INVALID');
  }
  async accept(context: WriteTransactionContext, value: FederationTransaction): Promise<FederationTransaction> {
    const database = this.transactions.database(context);
    const next = value.transition('callbackreceived', new Date());
    await transition(database, next, value.version);
    return next;
  }
  async advance(context: WriteTransactionContext, value: FederationTransaction, state: 'linkrequired' | 'rejected' | 'expired') {
    const database = this.transactions.database(context);
    const next = value.transition(state, new Date());
    await transition(database, next, value.version);
    return next;
  }
  async verified(context: WriteTransactionContext, value: FederationTransaction, subject: FederatedSubject, subjecthash: Buffer): Promise<FederationResolution> {
    const database = this.transactions.database(context);
    const advanced = value.transition('verified', new Date());
    await transition(database, advanced, value.version);
    const found = await database.query<{
      principal_id: string;
    }>(
      `select principal_id from identity.federatedidentity
      where provider_instance_id=$1 and normalized_subject_hash=$2 and status='active' and revoked_at is null`,
      [subject.instance, subjecthash]
    );
    const principals = [...new Set(found.rows.map(({ principal_id }) => principal_id).filter(Boolean))];
    if (principals.length !== 1) return Object.freeze({ principal: null, memberships: Object.freeze([]), conflict: principals.length > 1 });
    const member = await this.members.memberForPrincipal(context, principals[0]!);
    const memberships = await this.access.memberships(context, member, value.target);
    return Object.freeze({ principal: principals[0]!, memberships: Object.freeze(memberships.map(membershipCandidate)), conflict: false });
  }
  async bindDirectory(
    context: WriteTransactionContext,
    input: Readonly<{
      provider: string;
      principal: string;
      membership: string;
      subjecthash: Buffer;
      ciphertext: string;
      keyversion: string;
    }>
  ): Promise<void> {
    const database = this.transactions.database(context);
    const result = await database.query(
      `insert into identity.federatedidentity(id,principal_id,membership_id,provider,subject_ciphertext,subject_key_version,status,
      bound_at,provider_instance_id,provider_tenant_hash,normalized_subject_hash,linked_at,verified_at,last_seen_at,source,version,created_at,updated_at)
      select $1,$2,$3,provider.type,$4,$5,'active',clock_timestamp(),provider.id,provider.provider_tenant_hash,$6,clock_timestamp(),clock_timestamp(),
        clock_timestamp(),'directory',0,clock_timestamp(),clock_timestamp() from identity.provider provider where provider.id=$7 and provider.status='enabled'
      on conflict(provider_instance_id,provider_tenant_hash,normalized_subject_hash) where status='active' do nothing returning id`,
      [`federated:${randomUUID()}`, input.principal, input.membership, input.ciphertext, input.keyversion, input.subjecthash, input.provider]
    );
    if (result.rowCount !== 1) {
      const existing = await database.query(
        `select 1 from identity.federatedidentity where provider_instance_id=$1
      and normalized_subject_hash=$2 and principal_id=$3 and status='active'`,
        [input.provider, input.subjecthash, input.principal]
      );
      if (!existing.rows[0]) throw new DomainError('FEDERATION_LINK_CONFLICT');
    }
  }
  async preauthorize(
    context: WriteTransactionContext,
    value: FederationTransaction,
    principal: string,
    memberships: FederationResolution['memberships'],
    browserhash: Buffer,
    devicehash: Buffer,
    assurance: number,
    authorization: AuthTicketBinding,
    returnTarget: string
  ): Promise<
    Readonly<{
      token: string;
    }>
  > {
    const database = this.transactions.database(context);
    const next = value.transition('selectionrequired', new Date());
    await transition(database, next, value.version);
    const token = randomBytes(48).toString('base64url');
    const snapshot = memberships.map((membership) => ({ ...membership }));
    await database.query(
      `insert into identity.preauth(id,transaction_id,principal_id,token_hash,candidate_hash,candidate_memberships,browser_hash,
      expires_at,created_at,purpose,target,reference_id,device_hash,state,version,auth_state_hash,auth_nonce_hash,auth_pkce_challenge,assurance,return_target)
      values($1,$2,$3,$4,$5,$6::jsonb,$7,clock_timestamp()+interval '5 minutes',clock_timestamp(),
        'federationselection',$8,$2,$9,'active',0,$10,$11,$12,$13,$14)`,
      [
        randomUUID(),
        value.id,
        principal,
        hash(token),
        hash(JSON.stringify(snapshot)),
        JSON.stringify(snapshot),
        browserhash,
        value.target,
        devicehash,
        authorization.stateHash,
        authorization.nonceHash,
        authorization.challenge,
        assurance,
        returnTarget,
      ]
    );
    return Object.freeze({ token });
  }
  async complete(context: WriteTransactionContext, id: string, expected: number): Promise<void> {
    const database = this.transactions.database(context);
    const result = await database.query(
      `update identity.federationtransaction set status='completed',consumed_at=clock_timestamp(),version=version+1,
      updated_at=clock_timestamp() where id=$1 and version=$2 and status in('verified','selectionrequired','linkrequired') and consumed_at is null`,
      [id, expected]
    );
    if (result.rowCount !== 1) throw new DomainError('FEDERATION_TRANSACTION_CONSUMED');
  }
  async version(context: ReadTransactionContext, id: string): Promise<number> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      version: number;
    }>('select version from identity.federationtransaction where id=$1::uuid', [id]);
    return result.rows[0]?.version ?? -1;
  }
}
function transaction(row: TransactionRow | undefined): FederationTransaction {
  if (!row) throw new DomainError('FEDERATION_TRANSACTION_INVALID');
  return new FederationTransaction({
    id: row.id,
    provider: row.provider_id,
    state: row.status,
    version: Number(row.version),
    expiresat: row.expires_at,
    target: row.target,
    purpose: row.purpose,
    principal: row.link_principal_id,
    membership: row.link_membership_id,
  });
}
async function transition(database: SqlExecutor, value: FederationTransaction, expected: number): Promise<void> {
  const result = await database.query(
    `update identity.federationtransaction set status=$2,version=version+1,updated_at=clock_timestamp()
    where id=$1 and version=$3 and consumed_at is null`,
    [value.id, value.state, expected]
  );
  if (result.rowCount !== 1) throw new DomainError('FEDERATION_TRANSACTION_CONSUMED');
}
function hash(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
