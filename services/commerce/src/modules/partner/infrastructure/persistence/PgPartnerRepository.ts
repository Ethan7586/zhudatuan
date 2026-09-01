import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { PartnerRepository } from '../../application/port/PartnerRepository';
export class PgPartnerRepository implements PartnerRepository {
  constructor(private readonly transactions: PgTransactionAccess) {}
  async partners(context: ReadTransactionContext, input: Parameters<PartnerRepository['partners']>[1]) {
    const database = this.transactions.database(context);
    const result = await this.transactions
      .database(context)
      .query(
        `select id,scope_id,kind,name,status,version,created_at,updated_at from partner.partner where (scope_id=any($1::text[]) or id=$2) and ($3::timestamptz is null or (updated_at,id)<($3::timestamptz,$4)) order by updated_at desc,id desc limit $5`,
        [input.scopes, input.own, input.sort, input.id, input.fetch]
      );
    return result.rows;
  }
  async savePartner(context: WriteTransactionContext, input: Parameters<PartnerRepository['savePartner']>[1]) {
    const database = this.transactions.database(context);
    const result = await this.transactions
      .database(context)
      .query(
        `insert into partner.partner(id,scope_id,kind,name,status,version,created_at,updated_at) values($1,$2,$3,$4,$5,0,clock_timestamp(),clock_timestamp()) on conflict(id) do update set name=excluded.name,status=excluded.status,version=partner.partner.version+1,updated_at=clock_timestamp() where partner.partner.scope_id=$2 and ($6::bigint is null or partner.partner.version=$6) returning *`,
        [input.id, input.scope, input.kind, input.name, input.status, input.expectedVersion]
      );
    return result.rows[0] ?? null;
  }
  async stores(context: ReadTransactionContext, input: Parameters<PartnerRepository['stores']>[1]) {
    const database = this.transactions.database(context);
    const result = await this.transactions
      .database(context)
      .query(
        `select partner.id,partner.scope_id as scope,partner.name,partner.status,partner.version,store.mall_id as mall,store.region_code as "regionCode",store.service_radius_meters as "serviceRadiusMeters",store.address_ciphertext is not null as "addressConfigured",partner.created_at as "createdAt",partner.updated_at as "updatedAt" from partner.partner partner join partner.store store on store.id=partner.id where partner.kind='store' and partner.scope_id=any($1::text[]) and ($2::timestamptz is null or (partner.updated_at,partner.id)<($2::timestamptz,$3)) order by partner.updated_at desc,partner.id desc limit $4`,
        [input.scopes, input.sort, input.id, input.fetch]
      );
    return result.rows;
  }
  async storeScope(context: ReadTransactionContext, id: string, scopes: readonly string[]): Promise<string | null> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<{
      scope: string;
    }>("select scope_id scope from partner.partner where id=$1 and kind='store' and scope_id=any($2::text[])", [id, scopes]);
    return result.rows[0]?.scope ?? null;
  }
  async saveStore(context: WriteTransactionContext, input: Parameters<PartnerRepository['saveStore']>[1]) {
    const database = this.transactions.database(context);
    const partner = await database.query(
      `insert into partner.partner(id,scope_id,kind,name,status,version,created_at,updated_at) values($1,$2,'store',$3,$4,0,clock_timestamp(),clock_timestamp()) on conflict(id) do update set scope_id=excluded.scope_id,name=excluded.name,status=excluded.status,version=partner.partner.version+1,updated_at=clock_timestamp() where partner.partner.kind='store' and partner.partner.scope_id=any($5::text[]) and ($6::bigint is null or partner.partner.version=$6) returning id`,
      [input.id, input.scope, input.name, input.status, input.scopes, input.expectedVersion]
    );
    if (!partner.rows[0]) return null;
    await database.query(
      `insert into partner.store(id,mall_id,region_code,address_ciphertext,address_token,address_key_version,service_radius_meters) values($1,$2,$3,$4,$5,$6,$7) on conflict(id) do update set mall_id=excluded.mall_id,region_code=excluded.region_code,address_ciphertext=excluded.address_ciphertext,address_token=excluded.address_token,address_key_version=excluded.address_key_version,service_radius_meters=excluded.service_radius_meters`,
      [input.id, input.mall, input.region, input.ciphertext, input.token, input.keyVersion, input.radius]
    );
    const result = await database.query(
      `select partner.id,partner.scope_id as scope,partner.name,partner.status,partner.version,store.mall_id as mall,store.region_code as "regionCode",store.service_radius_meters as "serviceRadiusMeters",store.address_ciphertext is not null as "addressConfigured" from partner.partner partner join partner.store store on store.id=partner.id where partner.id=$1`,
      [input.id]
    );
    return result.rows[0] ?? null;
  }
}
