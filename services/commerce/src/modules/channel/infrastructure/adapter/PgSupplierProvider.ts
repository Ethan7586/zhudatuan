import type { CatalogBatch, JsonObject, ProviderPorts, RemoteOrderReceipt, RemoteOrderState, RemoteRefundReceipt, RemoteReturnInstruction, StatementFile, StockBatch, TrackingSnapshot } from '@shop/contract';
import type { LocalProviderInstallation } from '@shop/providercore';
import type { QueryResultRow } from 'pg';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';

interface PayloadRow extends QueryResultRow {
  readonly payload: unknown;
}

export function createSupplierProviderInstallation(pool: DatabasePool, scope: string): LocalProviderInstallation {
  const ports: Partial<ProviderPorts> = Object.freeze({
    catalog: {
      async pullCatalog(context, cursor): Promise<CatalogBatch> {
        return payload<CatalogBatch>(pool, 'select channel.pull_supplier_catalog($1,$2) as payload', [scope, cursor ?? null]);
      },
    },
    stock: {
      async pullStock(context, keys): Promise<StockBatch> {
        return payload<StockBatch>(pool, 'select channel.pull_supplier_stock($1,$2::jsonb) as payload', [scope, JSON.stringify(keys)]);
      },
    },
    order: {
      async submit(context, order): Promise<RemoteOrderReceipt> {
        return payload<RemoteOrderReceipt>(pool, 'select channel.submit_supplier_order($1,$2,$3,$4::jsonb) as payload', [scope, requiredKey(context.idempotencyKey), order.reference, JSON.stringify(order.payload)]);
      },
    },
    cancel: {
      async cancel(context, reference, reason): Promise<RemoteOrderState> {
        return payload<RemoteOrderState>(pool, 'select channel.cancel_supplier_order($1,$2,$3,$4) as payload', [scope, requiredKey(context.idempotencyKey), reference, reason]);
      },
    },
    tracking: {
      async pullTracking(context, reference): Promise<TrackingSnapshot> {
        return payload<TrackingSnapshot>(pool, 'select channel.pull_supplier_tracking($1,$2) as payload', [scope, reference]);
      },
    },
    return: {
      async authorize(context, request): Promise<RemoteReturnInstruction> {
        return payload<RemoteReturnInstruction>(pool, 'select channel.authorize_supplier_return($1,$2,$3::jsonb) as payload', [scope, requiredKey(context.idempotencyKey), JSON.stringify(request)]);
      },
    },
    refund: {
      async refund(context, request): Promise<RemoteRefundReceipt> {
        return payload<RemoteRefundReceipt>(pool, 'select channel.submit_supplier_refund($1,$2,$3::jsonb) as payload', [scope, requiredKey(context.idempotencyKey), JSON.stringify(request)]);
      },
    },
    statement: {
      async pullStatement(context, period): Promise<StatementFile> {
        return payload<StatementFile>(pool, 'select channel.build_supplier_statement($1,$2::jsonb) as payload', [scope, JSON.stringify(period)]);
      },
    },
  });
  return Object.freeze({
    ports,
    async health() {
      const result = await pool.query<{ enabled: boolean }>('select channel.supplier_enabled($1) as enabled', [scope]);
      return result.rows[0]?.enabled === true;
    },
  });
}

async function payload<T>(pool: DatabasePool, sql: string, values: readonly unknown[]): Promise<T> {
  const result = await pool.query<PayloadRow>(sql, values);
  const value = result.rows[0]?.payload;
  if (!isJsonObject(value)) throw new Error('SUPPLIER_PROVIDER_RESULT_INVALID');
  return value as T;
}

function requiredKey(value: string | undefined): string {
  if (!value) throw new Error('SUPPLIER_PROVIDER_IDEMPOTENCY_REQUIRED');
  return value;
}

function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
