import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  CatalogSource,
  PriceSource,
  ProviderCallContext,
  ProviderPorts,
  ProviderWebhookVerifier,
  RemoteOrderCanceller,
  RemoteOrderSubmitter,
  RemoteRefundProvider,
  RemoteReturnProvider,
  StatementSource,
  StockSource,
  TrackingSource,
  VerificationProvider,
} from '@shop/contract';
import type { IntegrationClient } from './integration';
import { ProviderMapper } from './Mapper';

export interface ProviderOperations {
  readonly catalog?: string;
  readonly price?: string;
  readonly stock?: string;
  readonly order?: string;
  readonly cancel?: string;
  readonly tracking?: string;
  readonly return?: string;
  readonly refund?: string;
  readonly statement?: string;
  readonly verification?: string;
}

export function createPorts(client: IntegrationClient, operations: ProviderOperations, mapper = new ProviderMapper(), secret?: Readonly<Record<string, string>>): Partial<ProviderPorts> {
  return Object.freeze({
    ...(operations.catalog ? { catalog: catalog(client, operations.catalog, mapper) } : {}),
    ...(operations.price ? { price: price(client, operations.price, mapper) } : {}),
    ...(operations.stock ? { stock: stock(client, operations.stock, mapper) } : {}),
    ...(operations.order ? { order: order(client, operations.order, mapper) } : {}),
    ...(operations.cancel ? { cancel: cancel(client, operations.cancel, mapper) } : {}),
    ...(operations.tracking ? { tracking: tracking(client, operations.tracking, mapper) } : {}),
    ...(operations.return ? { return: remoteReturn(client, operations.return, mapper) } : {}),
    ...(operations.refund ? { refund: refund(client, operations.refund, mapper) } : {}),
    ...(operations.statement ? { statement: statement(client, operations.statement, mapper) } : {}),
    ...(operations.verification ? { verification: verification(client, operations.verification, mapper) } : {}),
    ...(secret ? { webhook: webhook(secret) } : {}),
  });
}

function webhook(secret: Readonly<Record<string, string>>): ProviderWebhookVerifier {
  const key = secret.webhookSecret ?? secret.webhook ?? secret.secret;
  if (!key) throw new Error('PROVIDER_WEBHOOK_SECRET_MISSING');
  return {
    async verify(_context, request) {
      const timestamp = request.headers['x-provider-timestamp'];
      const signature = request.headers['x-provider-signature'];
      if (!timestamp || !signature || !/^\d{10,13}$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(signature)) return false;
      const milliseconds = timestamp.length === 10 ? Number(timestamp) * 1_000 : Number(timestamp);
      if (!Number.isSafeInteger(milliseconds) || Math.abs(new Date(request.receivedAt).getTime() - milliseconds) > 300_000) return false;
      const expected = createHmac('sha256', key).update(`${timestamp}.${request.body}`).digest();
      const actual = Buffer.from(signature, 'hex');
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    },
    normalize(request) {
      let value: unknown;
      try {
        value = JSON.parse(request.body);
      } catch (cause) {
        throw new Error('PROVIDER_WEBHOOK_BODY_INVALID', { cause });
      }
      if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('PROVIDER_WEBHOOK_BODY_INVALID');
      return value as import('@shop/contract').JsonObject;
    },
  };
}

function catalog(client: IntegrationClient, operation: string, mapper: ProviderMapper): CatalogSource {
  return {
    async pullCatalog(context, cursor) {
      const value = await client.invoke(context, { operation, method: 'POST', idempotent: true, body: cursor === undefined ? {} : { cursor } });
      const next = value.nextCursor;
      return {
        records: mapper.objects(value.records, 'PROVIDER_CATALOG_RECORDS_INVALID'),
        errors: [],
        complete: mapper.boolean(value.complete, 'PROVIDER_CATALOG_COMPLETE_INVALID'),
        ...(next === undefined ? {} : { nextCursor: mapper.string(next, 'PROVIDER_CATALOG_CURSOR_INVALID') }),
      };
    },
  };
}

function price(client: IntegrationClient, operation: string, mapper: ProviderMapper): PriceSource {
  return {
    async pullPrice(context, keys) {
      const value = await client.invoke(context, { operation, method: 'POST', idempotent: true, body: { keys: keys.map(({ externalId, region }) => ({ externalId, ...(region === undefined ? {} : { region }) })) } });
      return { records: mapper.objects(value.records, 'PROVIDER_PRICE_RECORDS_INVALID') };
    },
  };
}

function stock(client: IntegrationClient, operation: string, mapper: ProviderMapper): StockSource {
  return {
    async pullStock(context, keys) {
      const value = await client.invoke(context, { operation, method: 'POST', idempotent: true, body: { keys: keys.map(({ externalId, region }) => ({ externalId, ...(region === undefined ? {} : { region }) })) } });
      return { records: mapper.objects(value.records, 'PROVIDER_STOCK_RECORDS_INVALID') };
    },
  };
}

function order(client: IntegrationClient, operation: string, mapper: ProviderMapper): RemoteOrderSubmitter {
  return {
    async submit(context, draft) {
      const value = await client.invoke(context, { operation, method: 'POST', idempotent: false, body: { reference: draft.reference, payload: draft.payload } });
      return receipt(value, mapper);
    },
  };
}

function cancel(client: IntegrationClient, operation: string, mapper: ProviderMapper): RemoteOrderCanceller {
  return {
    async cancel(context, reference, reason) {
      const value = await client.invoke(context, { operation, method: 'POST', idempotent: false, body: { reference, reason } });
      return { externalReference: mapper.string(value.externalReference, 'PROVIDER_REFERENCE_INVALID'), state: mapper.string(value.state, 'PROVIDER_STATE_INVALID') };
    },
  };
}

function tracking(client: IntegrationClient, operation: string, mapper: ProviderMapper): TrackingSource {
  return {
    async pullTracking(context, reference) {
      const value = await client.invoke(context, { operation, method: 'POST', idempotent: true, body: { reference } });
      return { externalReference: mapper.string(value.externalReference, 'PROVIDER_REFERENCE_INVALID'), milestones: mapper.objects(value.milestones, 'PROVIDER_MILESTONES_INVALID') };
    },
  };
}

function refund(client: IntegrationClient, operation: string, mapper: ProviderMapper): RemoteRefundProvider {
  return {
    async refund(context, request) {
      const value = await client.invoke(context, { operation, method: 'POST', idempotent: false, body: { ...request } });
      return { externalReference: mapper.string(value.externalReference, 'PROVIDER_REFERENCE_INVALID'), state: mapper.string(value.state, 'PROVIDER_STATE_INVALID') };
    },
  };
}

function remoteReturn(client: IntegrationClient, operation: string, mapper: ProviderMapper): RemoteReturnProvider {
  return {
    async authorize(context, request) {
      const value = await client.invoke(context, { operation, method: 'POST', idempotent: false, body: { ...request } });
      return {
        externalReference: mapper.string(value.externalReference, 'PROVIDER_RETURN_REFERENCE_INVALID'),
        state: mapper.string(value.state, 'PROVIDER_RETURN_STATE_INVALID'),
        instruction: mapper.object(value.instruction, 'PROVIDER_RETURN_INSTRUCTION_INVALID'),
      };
    },
  };
}

function statement(client: IntegrationClient, operation: string, mapper: ProviderMapper): StatementSource {
  return {
    async pullStatement(context, period) {
      const value = await client.invoke(context, { operation, method: 'POST', idempotent: true, body: { ...period } });
      return { objectRef: mapper.string(value.objectRef, 'PROVIDER_OBJECT_REF_INVALID'), sha256: mapper.string(value.sha256, 'PROVIDER_STATEMENT_HASH_INVALID') };
    },
  };
}

function verification(client: IntegrationClient, operation: string, mapper: ProviderMapper): VerificationProvider {
  return {
    async verify(context, request) {
      const value = await client.invoke(context, { operation, method: 'POST', idempotent: false, body: { reference: request.reference, evidence: request.evidence } });
      return { externalReference: mapper.string(value.externalReference, 'PROVIDER_REFERENCE_INVALID'), state: mapper.string(value.state, 'PROVIDER_STATE_INVALID') };
    },
  };
}

function receipt(value: Readonly<Record<string, import('@shop/contract').JsonValue>>, mapper: ProviderMapper) {
  return {
    externalReference: mapper.string(value.externalReference, 'PROVIDER_REFERENCE_INVALID'),
    state: mapper.string(value.state, 'PROVIDER_STATE_INVALID'),
    rawReference: mapper.string(value.rawReference, 'PROVIDER_RAW_REFERENCE_INVALID'),
  };
}
