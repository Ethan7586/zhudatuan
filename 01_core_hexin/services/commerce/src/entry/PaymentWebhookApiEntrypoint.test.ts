import { createHash } from 'node:crypto';
import type { OperationId } from '@shop/contract';
import { WechatApplicationCatalog } from '@shop/config/server';
import { beforeAll, describe, expect, it } from 'vitest';
import { createWechatPayTestKeys, encryptNotificationResource, signedProviderHeaders, type WechatPayTestKeys }
  from '../../../../extensions/payment/wechat/test/TestKeys';
import { bootstrapApi } from '../bootstrap/ApiBootstrap';
import { ExtensionRegistry } from '../bootstrap/ExtensionRegistry';
import { PAYMENT_WEBHOOK_OPERATION_IDS, PaymentWebhookApiModule } from '../bootstrap/PaymentWebhookApiRuntime';
import type { OperationHandler } from '../foundation/application/OperationHandler';
import { AUDIT_SINK } from '../foundation/application/AuditSink';
import { OPERATION_AUTHORIZER, OPERATION_HANDLERS } from '../foundation/interface/OperationController';
import { DATABASE_POOL, type DatabasePool } from '../foundation/persistence/Pool';
import { commerceTelemetry } from '../foundation/telemetry/Telemetry';
import { RecordAudit } from '../modules/audit/application/command/RecordAudit';
import { PgAuditRepository } from '../modules/audit/infrastructure/persistence/PgAuditRepository';
import { PAYMENT_GATEWAY } from '../modules/payment_zhifu/01_public_gongkai/ports_jiekou/PaymentGateway';
import { WechatGateway } from '../modules/payment_zhifu/04_adapters_shixian/providers_waibu/WechatGateway';

let keys: WechatPayTestKeys;

beforeAll(async () => {
  keys = await createWechatPayTestKeys();
});

describe('payment webhook API entrypoint', () => {
  it('publishes only the canonical WeChat payment webhook operation', async () => {
    const database = fakeDatabase();
    const bootstrapped = await testApi(database.pool);
    expect(PAYMENT_WEBHOOK_OPERATION_IDS).toEqual(['payment.webhooks.wechat']);
    expect(bootstrapped.routes.catalog()).toEqual([{
      operation: 'payment.webhooks.wechat', method: 'POST', path: '/api/v1/webhooks/wechat/payment',
    }]);
    expect(bootstrapped.routes.match('POST', '/api/v1/payments/intents')).toBeNull();
    expect(bootstrapped.routes.match('POST', '/api/v1/payments/refunds')).toBeNull();
    expect(bootstrapped.routes.match('GET', '/health/ready')).toBeNull();
  });

  it('rejects missing and incorrect WeChat signatures before opening a database transaction', async () => {
    const database = fakeDatabase();
    const { app } = await testApi(database.pool);
    const body = await paymentNotificationBody();
    const missing = await app.handle(request(body, new Headers({ 'content-type': 'application/json' })));
    expect(missing.status).toBe(400);
    await expect(missing.json()).resolves.toMatchObject({ code: 'PROVIDER_SIGNATURE_MISSING' });

    const headers = await signedProviderHeaders(keys, body, currentTimestamp());
    const incorrect = await app.handle(request(`${body} `, headers));
    expect(incorrect.status).toBe(400);
    await expect(incorrect.json()).resolves.toMatchObject({ code: 'PROVIDER_WEBHOOK_SIGNATURE_INVALID' });
    expect(database.connections()).toBe(0);
    expect(database.jobs()).toBe(0);
    expect(database.audits()).toBe(0);
  });

  it('verifies and decrypts an encrypted fixture and accepts duplicate notifications idempotently', async () => {
    const database = fakeDatabase();
    const { app } = await testApi(database.pool);
    const body = await paymentNotificationBody();
    const headers = await signedProviderHeaders(keys, body, currentTimestamp());
    const first = await app.handle(request(body, headers));
    const duplicate = await app.handle(request(body, headers));
    expect(first.status).toBe(204);
    expect(duplicate.status).toBe(204);
    expect(database.connections()).toBe(2);
    expect(database.providerAccepts()).toBe(2);
    expect(database.jobs()).toBe(1);
    expect(database.audits()).toBe(1);
  });
});

async function testApi(pool: DatabasePool) {
  const gateway = new WechatGateway(WechatApplicationCatalog.parse({ applications: [
    { scene: 'miniapp', appId: keys.appId },
    { scene: 'jsapi', appId: 'wxbcbec8d29708e1c4' },
  ] }), keys.config);
  return bootstrapApi({
    modules: [PaymentWebhookApiModule],
    operationIds: PAYMENT_WEBHOOK_OPERATION_IDS,
    extensions: new ExtensionRegistry({ verify: async () => false }),
    allowedOrigins: [],
    telemetry: commerceTelemetry(),
    configure(container) {
      container.bind(OPERATION_HANDLERS, new Map<OperationId, OperationHandler>());
      container.bind(OPERATION_AUTHORIZER, { authorize: async () => { throw new Error('AUTHORIZATION_NOT_CALLED'); } });
      container.bind(DATABASE_POOL, pool);
      container.bind(PAYMENT_GATEWAY, gateway);
      container.bind(AUDIT_SINK, new RecordAudit(new PgAuditRepository()));
    },
  });
}

function fakeDatabase() {
  let connectionCount = 0;
  let providerAcceptCount = 0;
  let jobCount = 0;
  let auditCount = 0;
  const accepted = new Set<string>();
  const client = {
    async query(sql: string, values: readonly unknown[] = []) {
      if (sql.includes('select payment.webhook_scope')) return result([{ scope: 'mall:one' }]);
      if (sql.includes('select intent.id')) return result([{
        id: 'intent:one', amount_minor: 1, currency: 'CNY', scope_id: 'mall:one',
        payer_hash: digest('openidMember123456'), scene: 'miniapp', application_hash: digest(keys.appId),
      }]);
      if (sql.includes('runtime.accept_provider_webhook')) {
        providerAcceptCount += 1;
        const id = String(values[1]);
        if (accepted.has(id)) return result([{ status: 'duplicate' }]);
        accepted.add(id);
        return result([{ status: 'accepted' }]);
      }
      if (sql.includes('insert into runtime.job')) {
        jobCount += 1;
        return result([]);
      }
      if (sql.includes('select record_hash from(')) return result([]);
      if (sql.includes('insert into audit.record')) {
        auditCount += 1;
        return result([]);
      }
      return result([]);
    },
    release() {},
  };
  const pool = {
    workload() { return pool; },
    async connect() {
      connectionCount += 1;
      return client;
    },
  } as unknown as DatabasePool;
  return Object.freeze({
    pool,
    connections: () => connectionCount,
    providerAccepts: () => providerAcceptCount,
    jobs: () => jobCount,
    audits: () => auditCount,
  });
}

async function paymentNotificationBody(): Promise<string> {
  const resource = await encryptNotificationResource(keys.config.apiV3Key, {
    appid: keys.appId,
    mchid: keys.config.mchId,
    out_trade_no: 'SW202609030001',
    transaction_id: '420000000020260903000001',
    trade_type: 'JSAPI',
    trade_state: 'SUCCESS',
    trade_state_desc: 'SUCCESS',
    success_time: '2026-09-03T10:00:00+08:00',
    payer: { openid: 'openidMember123456' },
    amount: { total: 1, payer_total: 1, currency: 'CNY', payer_currency: 'CNY' },
  });
  return JSON.stringify({
    id: 'EV-20260903-0001',
    create_time: '2026-09-03T10:00:01+08:00',
    event_type: 'TRANSACTION.SUCCESS',
    resource_type: 'encrypt-resource',
    summary: 'SUCCESS',
    resource: { original_type: 'transaction', algorithm: 'AEAD_AES_256_GCM', ...resource },
  });
}

function request(body: string, headers: Headers): Request {
  return new Request('http://127.0.0.1/api/v1/webhooks/wechat/payment', { method: 'POST', headers, body });
}

function currentTimestamp(): string {
  return Math.floor(Date.now() / 1_000).toString();
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function result(rows: readonly object[]) {
  return { rows, rowCount: rows.length, command: '', oid: 0, fields: [] };
}
