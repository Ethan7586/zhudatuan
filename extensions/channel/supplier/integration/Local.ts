import type {
  CatalogBatch,
  JsonObject,
  PriceBatch,
  ProviderCallContext,
  ProviderPorts,
  RemoteOrderReceipt,
  RemoteOrderState,
  RemoteRefundReceipt,
  RemoteReturnInstruction,
  StatementFile,
  StockBatch,
  TrackingSnapshot,
} from '@shop/contract';
import type { LocalProviderInstallation, LocalProviderRuntime } from '@shop/providercore';

const operation = Object.freeze({
  health: 'channel.supplier_enabled',
  catalog: 'channel.pull_supplier_catalog',
  stock: 'channel.pull_supplier_stock',
  quote: 'channel.quote_supplier_products',
  order: 'channel.submit_supplier_order',
  cancel: 'channel.cancel_supplier_order',
  tracking: 'channel.pull_supplier_tracking',
  return: 'channel.authorize_supplier_return',
  refund: 'channel.submit_supplier_refund',
  statement: 'channel.build_supplier_statement',
});

export function createSupplierInstallation(runtime: LocalProviderRuntime): LocalProviderInstallation {
  if (!runtime.scope.trim()) throw new Error('SUPPLIER_PROVIDER_SCOPE_REQUIRED');
  const ports: Partial<ProviderPorts> = Object.freeze({
    catalog: {
      async pullCatalog(context, cursor): Promise<CatalogBatch> {
        return invoke<CatalogBatch>(runtime, context, operation.catalog, [cursor ?? null]);
      },
    },
    stock: {
      async pullStock(context, keys): Promise<StockBatch> {
        return invoke<StockBatch>(runtime, context, operation.stock, [keys]);
      },
    },
    price: {
      async pullPrice(context, keys): Promise<PriceBatch> {
        return invoke<PriceBatch>(runtime, context, operation.quote, [keys]);
      },
    },
    order: {
      async submit(context, order): Promise<RemoteOrderReceipt> {
        return invoke<RemoteOrderReceipt>(runtime, context, operation.order, [requiredKey(context.idempotencyKey), order.reference, order.payload]);
      },
    },
    cancel: {
      async cancel(context, reference, reason): Promise<RemoteOrderState> {
        return invoke<RemoteOrderState>(runtime, context, operation.cancel, [requiredKey(context.idempotencyKey), reference, reason]);
      },
    },
    tracking: {
      async pullTracking(context, reference): Promise<TrackingSnapshot> {
        return invoke<TrackingSnapshot>(runtime, context, operation.tracking, [reference]);
      },
    },
    return: {
      async authorize(context, request): Promise<RemoteReturnInstruction> {
        return invoke<RemoteReturnInstruction>(runtime, context, operation.return, [requiredKey(context.idempotencyKey), request]);
      },
    },
    refund: {
      async refund(context, request): Promise<RemoteRefundReceipt> {
        return invoke<RemoteRefundReceipt>(runtime, context, operation.refund, [requiredKey(context.idempotencyKey), request]);
      },
    },
    statement: {
      async pullStatement(context, period): Promise<StatementFile> {
        return invoke<StatementFile>(runtime, context, operation.statement, [period]);
      },
    },
  });
  return Object.freeze({
    ports,
    async health() {
      const value = await runtime.invoke(operation.health, []);
      if (typeof value !== 'boolean') throw new Error('SUPPLIER_PROVIDER_HEALTH_INVALID');
      return value;
    },
  });
}

async function invoke<T>(runtime: LocalProviderRuntime, context: ProviderCallContext, name: string, arguments_: readonly unknown[]): Promise<T> {
  if (!Number.isFinite(context.deadline) || context.deadline <= Date.now()) throw new Error('PROVIDER_DEADLINE_EXCEEDED');
  const value = await runtime.invoke(name, arguments_);
  if (!isJsonObject(value)) throw new Error('SUPPLIER_PROVIDER_RESULT_INVALID');
  if (context.deadline <= Date.now()) throw new Error('PROVIDER_DEADLINE_EXCEEDED');
  return value as T;
}

function requiredKey(value: string | undefined): string {
  if (!value?.trim()) throw new Error('SUPPLIER_PROVIDER_IDEMPOTENCY_REQUIRED');
  return value;
}

function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
