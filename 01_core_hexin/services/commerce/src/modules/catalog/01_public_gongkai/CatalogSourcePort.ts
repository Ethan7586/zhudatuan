import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

export interface CatalogSourceInput {
  readonly id: string;
  readonly provider: string;
  readonly external: string;
  readonly scope: string;
  readonly version: string;
  readonly payload: string;
  readonly hash: string;
}

export class CatalogSourcePort {
  async accept(database: OperationDatabase, input: CatalogSourceInput): Promise<void> {
    await database.query(`insert into catalog.sourcelisting(id,provider,external_id,object_type,scope_id,source_version,source_payload,source_hash,status,observed_at)
      values($1,$2,$3,'product',$4,$5,$6::jsonb,$7,'pending',clock_timestamp()) on conflict(provider,scope_id,object_type,external_id) do update
      set source_version=excluded.source_version,source_payload=excluded.source_payload,source_hash=excluded.source_hash,
      status=case when catalog.sourcelisting.sku_id is null then 'pending' else 'mapped' end,observed_at=excluded.observed_at`,
    [input.id, input.provider, input.external, input.scope, input.version, input.payload, input.hash]);
  }

  async sku(database: OperationDatabase, provider: string, scope: string, external: string): Promise<string | null> {
    const mapped = await database.query<{ sku_id: string }>(`select sku_id from catalog.sourcelisting
      where provider=$1 and scope_id=$2 and external_id=$3 and sku_id is not null`, [provider, scope, external]);
    return mapped.rows[0]?.sku_id ?? null;
  }

  async keys(database: OperationDatabase, provider: string, scope: string, after: string | null): Promise<readonly string[]> {
    const result = await database.query<{ external_id: string }>(`select external_id from catalog.sourcelisting where provider=$1 and scope_id=$2
      and sku_id is not null and ($3::text is null or external_id>$3) order by external_id limit 500`, [provider, scope, after]);
    return result.rows.map(({ external_id }) => external_id);
  }
}

export const catalogSourcePort = new CatalogSourcePort();
