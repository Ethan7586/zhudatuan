import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { createHash, createHmac } from 'node:crypto';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { ProviderRepository, ProviderSummary } from '../../application/port/ProviderRepository';
import { ProviderInstance, type ProviderInstanceValue } from '../../domain/model/ProviderInstance';
import type { ProviderHttpClient } from '../security/ProviderHttpClient';
interface ProviderRow {
  readonly id: string;
  readonly tenant_id: string;
  readonly type: ProviderInstanceValue['type'];
  readonly secret_ref: string;
  readonly redirect_uri: string;
  readonly scopes: string[];
  readonly status: ProviderInstanceValue['status'];
  readonly version: number;
  readonly created_at: Date;
  readonly updated_at: Date;
}
export class PgProviderRepository implements ProviderRepository {
  private readonly transactions = new PgTransactionAccess();
  constructor(
    private readonly client: ProviderHttpClient,
    private readonly hashkey: string
  ) {
    if (hashkey.length < 32) throw new Error('IDENTITY_PROVIDER_HASH_KEY_INVALID');
  }
  async list(context: ReadTransactionContext, tenant?: string): Promise<readonly ProviderSummary[]> {
    const database = this.transactions.database(context);
    const result = await database.query<ProviderRow>(
      `select id,tenant_id,type,secret_ref,redirect_uri,scopes,status,version,created_at,updated_at
      from identity.provider where status='enabled' and ($1::uuid is null or tenant_id=$1) order by type,id limit 64`,
      [tenant ?? null]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ id: row.id, type: row.type, status: 'enabled' as const })));
  }
  async require(context: ReadTransactionContext, id: string): Promise<ProviderInstance> {
    const database = this.transactions.database(context);
    const result = await database.query<ProviderRow>(
      `select id,tenant_id,type,secret_ref,redirect_uri,scopes,status,version,created_at,updated_at
      from identity.provider where id=$1`,
      [id]
    );
    const row = result.rows[0];
    if (!row) throw new DomainError('IDENTITY_PROVIDER_CONFIGURATION_INVALID');
    return this.map(row);
  }
  async save(context: WriteTransactionContext, value: ProviderInstanceValue, expected: number, _kms: KmsClient): Promise<ProviderInstance> {
    const database = this.transactions.database(context);
    const validated = new ProviderInstance(value);
    const credentials = await this.client.credentials(validated.secretref);
    if (credentials.clientid !== validated.clientid || (credentials.issuer ?? null) !== validated.issuer) {
      throw new DomainError('IDENTITY_PROVIDER_CONFIGURATION_INVALID');
    }
    const result = await database.query<ProviderRow>(
      `insert into identity.provider(id,tenant_id,type,provider_tenant_hash,issuer_hash,client_id_hash,
        secret_ref,redirect_uri,scopes,status,version,created_at,updated_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,clock_timestamp(),clock_timestamp())
      on conflict(id) do update set type=excluded.type,provider_tenant_hash=excluded.provider_tenant_hash,issuer_hash=excluded.issuer_hash,
        client_id_hash=excluded.client_id_hash,secret_ref=excluded.secret_ref,redirect_uri=excluded.redirect_uri,scopes=excluded.scopes,
        status=excluded.status,version=identity.provider.version+1,updated_at=clock_timestamp()
      where identity.provider.tenant_id=excluded.tenant_id and identity.provider.version=$11
      returning id,tenant_id,type,secret_ref,redirect_uri,scopes,status,version,created_at,updated_at`,
      [
        validated.id,
        validated.tenantid,
        validated.type,
        this.digest(credentials.tenant),
        validated.issuer === null ? null : createHash('sha256').update(validated.issuer).digest(),
        createHash('sha256').update(validated.clientid).digest(),
        validated.secretref,
        validated.redirecturi,
        validated.scopes,
        validated.status,
        expected,
      ]
    );
    const row = result.rows[0];
    if (!row) throw new Error('EXPECTED_VERSION_MISMATCH');
    return this.map(row);
  }
  private async map(row: ProviderRow): Promise<ProviderInstance> {
    const credentials = await this.client.credentials(row.secret_ref);
    return new ProviderInstance({
      id: row.id,
      type: row.type,
      tenantid: row.tenant_id,
      issuer: credentials.issuer,
      clientid: credentials.clientid,
      secretref: row.secret_ref,
      status: row.status,
      redirecturi: row.redirect_uri,
      scopes: row.scopes,
      version: row.version,
      createdat: row.created_at.toISOString(),
      updatedat: row.updated_at.toISOString(),
    });
  }
  private digest(value: string): Buffer {
    return createHmac('sha256', this.hashkey).update(value).digest();
  }
}
