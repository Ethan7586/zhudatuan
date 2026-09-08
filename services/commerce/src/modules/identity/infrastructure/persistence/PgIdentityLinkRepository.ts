import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { DomainError } from '../../../../platform/error/DomainError';
import { randomUUID } from 'node:crypto';
import type { IdentityLinkRepository } from '../../application/port/IdentityLinkRepository';
import { IdentityLink } from '../../domain/model/IdentityLink';
import { LinkPolicy } from '../../domain/policy/LinkPolicy';
export class PgIdentityLinkRepository implements IdentityLinkRepository {
  private readonly transactions = new PgTransactionAccess();
  private readonly policy = new LinkPolicy();
  async list(context: ReadTransactionContext, principal: string): Promise<readonly IdentityLink[]> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      id: string;
      provider_instance_id: string;
      principal_id: string;
      status: 'active' | 'revoked';
      version: number;
    }>(`select id,provider_instance_id,principal_id,status,version from identity.federatedidentity where principal_id=$1 order by linked_at,id`, [principal]);
    return Object.freeze(result.rows.map((row) => new IdentityLink(row.id, row.provider_instance_id, row.principal_id, row.status, row.version)));
  }
  async create(context: WriteTransactionContext, input: Parameters<IdentityLinkRepository['create']>[1]): Promise<IdentityLink> {
    const database = this.transactions.database(context);
    const id = `federated:${randomUUID()}`;
    const result = await database.query<{
      id: string;
      provider_instance_id: string;
      principal_id: string;
      status: 'active';
      version: number;
    }>(
      `insert into identity.federatedidentity(id,principal_id,membership_id,provider,subject_ciphertext,subject_key_version,status,bound_at,
        provider_instance_id,provider_tenant_hash,normalized_subject_hash,linked_at,verified_at,last_seen_at,source,version,created_at,updated_at)
      select $1,$2,$3,provider.type,$4,$5,'active',clock_timestamp(),provider.id,
        provider.provider_tenant_hash,$6,clock_timestamp(),clock_timestamp(),clock_timestamp(),'manual',0,clock_timestamp(),clock_timestamp()
      from identity.provider provider where provider.id=$7 and provider.status='enabled'
      on conflict(provider_instance_id,provider_tenant_hash,normalized_subject_hash) where status='active' do nothing
      returning id,provider_instance_id,principal_id,status,version`,
      [id, input.principal, input.membership, input.ciphertext, input.keyversion, input.subjecthash, input.provider]
    );
    const row = result.rows[0];
    if (!row) throw new DomainError('FEDERATION_LINK_CONFLICT');
    return new IdentityLink(row.id, row.provider_instance_id, row.principal_id, row.status, row.version);
  }
  async revoke(context: WriteTransactionContext, principal: string, link: string): Promise<void> {
    const database = this.transactions.database(context);
    const target = await database.query(
      `select id from identity.federatedidentity
      where id=$1 and principal_id=$2 and status='active' and revoked_at is null for update`,
      [link, principal]
    );
    if (!target.rows[0]) throw new DomainError('FEDERATION_LINK_REQUIRED');
    const count = await database.query<{
      count: string;
    }>(
      `select count(*) count from(
        select id from identity.federatedidentity where principal_id=$1 and id<>$2 and status='active' and revoked_at is null
        union all
        select id from identity.credential where principal_id=$1 and status='active'
      ) alternative`,
      [principal, link]
    );
    this.policy.assertAlternative(Number(count.rows[0]?.count ?? 0));
    const result = await database.query(
      `update identity.federatedidentity set status='revoked',revoked_at=clock_timestamp(),version=version+1,
      updated_at=clock_timestamp() where id=$1 and principal_id=$2 and status='active'`,
      [link, principal]
    );
    if (result.rowCount !== 1) throw new DomainError('FEDERATION_LINK_REQUIRED');
  }
}
