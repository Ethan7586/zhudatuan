import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { PartnerRepository } from '../../application/port/PartnerRepository';
export class PgPartnerRepository implements PartnerRepository {
  constructor(private readonly transactions: PgTransactionAccess) {}
  async partners(context: ReadTransactionContext, input: Parameters<PartnerRepository['partners']>[1]) {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query(
      `select subject.id,subject.scope_id,subject.kind,subject.name,subject.status,subject.version,subject.created_at,subject.updated_at,
        jsonb_build_object('valid',count(document.id) filter(where document.status='valid'),'pending',count(document.id) filter(where document.status='pending'),
          'rejected',count(document.id) filter(where document.status='rejected'),'expired',count(document.id) filter(where document.status='expired'),
          'nearest_expiry',min(document.expires_at) filter(where document.status='valid' and document.expires_at is not null)) qualification
        from partner.partner subject left join partner.qualificationdocument document on document.partner_id=subject.id
        where (subject.scope_id=any($1::text[]) or subject.id=$2) and ($3::text is null or subject.kind=$3)
          and ($4::timestamptz is null or (subject.updated_at,subject.id)<($4::timestamptz,$5))
        group by subject.id order by subject.updated_at desc,subject.id desc limit $6`,
      [input.scopes, input.own, input.kind, input.sort, input.id, input.fetch]
    );
    return result.rows;
  }
  async savePartner(context: WriteTransactionContext, input: Parameters<PartnerRepository['savePartner']>[1]) {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query(
      `with target as (
          insert into partner.partner(id,scope_id,kind,name,status,version,created_at,updated_at) values($1,$2,$3,$4,$5,0,clock_timestamp(),clock_timestamp())
          on conflict(id) do update set name=excluded.name,status=excluded.status,version=partner.partner.version+1,updated_at=clock_timestamp()
          where partner.partner.scope_id=$2 and partner.partner.kind=$3 and ($6::bigint is null or partner.partner.version=$6)
          returning id,scope_id,kind,name,status,version,created_at,updated_at
        ) select target.id,target.scope_id,target.kind,target.name,target.status,target.version,target.created_at,target.updated_at,
          jsonb_build_object('valid',count(document.id) filter(where document.status='valid'),'pending',count(document.id) filter(where document.status='pending'),
            'rejected',count(document.id) filter(where document.status='rejected'),'expired',count(document.id) filter(where document.status='expired'),
            'nearest_expiry',min(document.expires_at) filter(where document.status='valid' and document.expires_at is not null)) qualification
          from target left join partner.qualificationdocument document on document.partner_id=target.id group by target.id,target.scope_id,target.kind,target.name,target.status,target.version,target.created_at,target.updated_at`,
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
      `insert into partner.store(id,mall_id,region_code,address_ciphertext,address_token,address_key_version,service_radius_meters) values($1,$2,$3,$4,$5,$6,$7)
      on conflict(id) do update set mall_id=excluded.mall_id,region_code=excluded.region_code,
        address_ciphertext=case when $8 then excluded.address_ciphertext else partner.store.address_ciphertext end,
        address_token=case when $8 then excluded.address_token else partner.store.address_token end,
        address_key_version=case when $8 then excluded.address_key_version else partner.store.address_key_version end,
        service_radius_meters=excluded.service_radius_meters`,
      [input.id, input.mall, input.region, input.ciphertext ?? null, input.token ?? null, input.keyVersion ?? null, input.radius, input.addressChanged]
    );
    const result = await database.query(
      `select partner.id,partner.scope_id as scope,partner.name,partner.status,partner.version,store.mall_id as mall,store.region_code as "regionCode",store.service_radius_meters as "serviceRadiusMeters",store.address_ciphertext is not null as "addressConfigured" from partner.partner partner join partner.store store on store.id=partner.id where partner.id=$1`,
      [input.id]
    );
    return result.rows[0] ?? null;
  }
}
