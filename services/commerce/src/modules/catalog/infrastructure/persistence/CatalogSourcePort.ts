import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { CatalogSourceInput } from '../../public/CatalogSource';
export class CatalogSourcePort {
  private readonly transactions = new PgTransactionAccess();
  async accept(context: WriteTransactionContext, input: CatalogSourceInput): Promise<void> {
    const database = this.transactions.database(context);
    await database.query(
      `insert into catalog.sourcelisting(id,provider,external_id,object_type,scope_id,source_version,source_payload,source_hash,status,observed_at)
      values($1,$2,$3,'product',$4,$5,$6::jsonb,$7,'pending',clock_timestamp()) on conflict(provider,scope_id,object_type,external_id) do update
      set source_version=excluded.source_version,source_payload=excluded.source_payload,source_hash=excluded.source_hash,
      status=case when catalog.sourcelisting.sku_id is null then 'pending' else 'mapped' end,observed_at=excluded.observed_at`,
      [input.id, input.provider, input.external, input.scope, input.version, input.payload, input.hash]
    );
  }
  async sku(context: ReadTransactionContext, provider: string, scope: string, external: string): Promise<string | null> {
    const database = this.transactions.database(context);
    const mapped = await database.query<{
      sku_id: string;
    }>(
      `select sku_id from catalog.sourcelisting
      where provider=$1 and scope_id=$2 and external_id=$3 and sku_id is not null`,
      [provider, scope, external]
    );
    return mapped.rows[0]?.sku_id ?? null;
  }
  async keys(context: ReadTransactionContext, provider: string, scope: string, after: string | null): Promise<readonly string[]> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      external_id: string;
    }>(
      `select external_id from catalog.sourcelisting where provider=$1 and scope_id=$2
      and sku_id is not null and ($3::text is null or external_id>$3) order by external_id limit 500`,
      [provider, scope, after]
    );
    return result.rows.map(({ external_id }) => external_id);
  }
}
