import type { ProviderCapability } from '@shop/contract';
import { describe, expect, it } from 'vitest';
import { Connection } from '../domain/model/Connection';
import { ExternalMapping } from '../domain/model/ExternalMapping';
import { SyncRun } from '../domain/model/SyncRun';
import { WebhookInbox } from '../domain/model/WebhookInbox';
import { WebhookReceipt } from '../domain/model/WebhookReceipt';
import { Binding, Distributor } from '../domain/model/Distributor';
import { Quota } from '../domain/model/Quota';
import { ProviderOperation, providerResponse, providerResult } from '../domain/model/ProviderOperation';
import { ChannelPolicy } from '../domain/policy/ChannelPolicy';
import { SyncPolicy } from '../domain/policy/SyncPolicy';

const hash = 'a'.repeat(64);
const watermark = '2026-09-06T00:00:00.000Z';

describe('channel domain model', () => {
  it('freezes the connection contract, capability snapshot and opaque Secret reference', () => {
    const capabilities = ['Catalog', 'Inventory'] as ProviderCapability[];
    const connection = new Connection({
      id: 'connection:one', provider: 'supplier', scope: 'mall:one', state: 'testing', contractVersion: 'supplier.v1',
      capabilities, secretRef: 'vault/channel/one', region: 'CN', version: 3,
      limits: { connectionTimeoutMs: 100, responseTimeoutMs: 200, totalDeadlineMs: 500, maxConcurrency: 4,
        requestsPerSecond: 10, maxAttempts: 3, failureThreshold: 5, recoveryMs: 1_000 },
    });
    capabilities.push('Price');
    expect(connection.capabilities).toEqual(['Catalog', 'Inventory']);
    expect(connection).not.toHaveProperty('secret');
    expect(() => new ChannelPolicy().requireTransition(connection, 'enabled')).not.toThrow();
  });

  it('binds a committed sync cursor and watermark to a classified, versioned run', () => {
    const run = new SyncRun({ id: 'sync:one', connection: 'connection:one', kind: 'catalog', state: 'failed', inputHash: hash,
      progress: { pulled: 4, accepted: 2, rejected: 1, phase: 'commit', cursor: 'page:2', watermark },
      failure: { classification: 'timeout', code: 'PROVIDER_TIMEOUT', retryable: true }, version: 2 });
    expect(run.progress.cursor).toBe('page:2');
    expect(run.failure).toEqual({ classification: 'timeout', code: 'PROVIDER_TIMEOUT', retryable: true });
    expect(() => new SyncRun({ ...run, state: 'completed', failure: run.failure })).toThrow('CHANNEL_SYNC_FAILURE_INVALID');
  });

  it('makes external identity scope-safe and versioned', () => {
    const mapping = new ExternalMapping({ provider: 'supplier', scope: 'mall:one', objectType: 'product', externalId: 'A',
      internalType: 'sku', internalId: 'sku:one', sourceVersion: '7', watermark, version: 1 });
    expect(mapping.identity).toBe('supplier:mall:one:product:A');
  });

  it('retains only webhook evidence hashes and classified failure metadata', () => {
    const webhook = new WebhookInbox({ id: 'webhook:one', receipt: 'webhookreceipt:one', connection: 'connection:one', externalId: 'event:one', eventType: 'refund',
      state: 'failed', attempts: 2, rawHash: hash, signatureHash: hash, watermark,
      failure: { classification: 'authentication', code: 'PROVIDER_SIGNATURE_INVALID', retryable: false }, version: 2 });
    expect(webhook).not.toHaveProperty('raw');
    expect(webhook.failure?.retryable).toBe(false);
    const receipt = new WebhookReceipt({ id: `webhookreceipt:${hash}`, connection: 'connection:one', provider: 'supplier', scope: 'mall:one',
      externalId: 'event:one', state: 'processing', attempts: 1, ciphertext: 'kms:ciphertext', keyVersion: 'kms:v1',
      rawHash: hash, signatureHash: hash, receivedAt: watermark, trace: 'trace:one', failure: null, version: 1 });
    expect(receipt.value.state).toBe('processing');
  });

  it('protects distributor termination, binding periods and quota boundaries', () => {
    const distributor = new Distributor({ id: 'distributor:one', organization: 'distributor:one', code: 'DIST.1', name: '渠道一',
      settlementMode: 'monthly', metadata: {}, state: 'active', activeBindings: 1, hasContact: true, version: 1 });
    expect(() => distributor.requireTermination()).toThrow('CHANNEL_DISTRIBUTOR_BINDING_ACTIVE');
    expect(() => new Binding({ id: 'binding:one', distributor: 'distributor:one', tenant: 'tenant:one', state: 'active',
      effectiveAt: watermark, expiresAt: '2026-09-05T00:00:00.000Z', version: 0 })).toThrow('CHANNEL_BINDING_INVALID');
    const quota = new Quota({ id: 'quota:one', scope: 'mall:one', capability: 'channel.orders.submit', state: 'enabled',
      limit: 2, effectiveAt: watermark, expiresAt: null, version: 0 });
    const policy = new ChannelPolicy();
    expect(policy.quotaAllows(quota, 1, '2026-09-06T01:00:00.000Z')).toBe(true);
    expect(policy.quotaAllows(quota, 2, '2026-09-06T01:00:00.000Z')).toBe(false);
  });

  it('stores only a whitelisted provider response summary', () => {
    const response = providerResponse({ state: 'accepted', externalReference: 'external:one', secret: 'do-not-store',
      mobile: '13800000000', address: { line: 'do-not-store' }, instruction: 'do-not-store' });
    const operation = new ProviderOperation({ id: 'operation:one', provider: 'supplier', scope: 'mall:one', kind: 'order',
      idempotency: 'fulfillment:one', internalReference: 'fulfillment:one', externalReference: 'external:one', state: 'processing',
      requestHash: hash, responseSummary: response.summary, responseHash: response.hash, version: 0 });
    expect(operation.value.responseSummary).toEqual({ state: 'accepted', externalReference: 'external:one' });
    expect(JSON.stringify(operation.value)).not.toContain('13800000000');
    expect(providerResult({ state: 'accepted', externalReference: 'external:one' })).toEqual({ state: 'accepted', externalReference: 'external:one' });
    expect(() => providerResult({ state: 'accepted', externalReference: 'external:one', secret: 'forbidden' } as never)).toThrow('CHANNEL_PROVIDER_RESULT_INVALID');
    expect(() => new ChannelPolicy().requireOperationTransition(operation, 'queued')).toThrow('CHANNEL_PROVIDER_OPERATION_TRANSITION_INVALID');
    expect(new ChannelPolicy().webhookTransition(operation, 'succeeded')).toBe('apply');
    const completed = new ProviderOperation({ ...operation.value, state: 'succeeded' });
    expect(new ChannelPolicy().webhookTransition(completed, 'processing')).toBe('stale');
    expect(new ChannelPolicy().webhookTransition(completed, 'succeeded')).toBe('duplicate');
    const unknown = new ProviderOperation({ ...operation.value, state: 'unknown' });
    expect(() => new ChannelPolicy().requireReplay(unknown)).not.toThrow();
    expect(new ChannelPolicy().webhookTransition(unknown, 'processing')).toBe('apply');
    expect(new ChannelPolicy().webhookTransition(unknown, 'succeeded')).toBe('apply');
  });

  it('centralizes rate admission, cursor commit and retry classification', () => {
    const connection = new Connection({ id: 'connection:one', provider: 'supplier', scope: 'mall:one', state: 'enabled', contractVersion: 'supplier.v1',
      capabilities: ['Catalog'], secretRef: null, region: 'CN', version: 1,
      limits: { connectionTimeoutMs: 100, responseTimeoutMs: 200, totalDeadlineMs: 500, maxConcurrency: 2,
        requestsPerSecond: 2, maxAttempts: 3, failureThreshold: 5, recoveryMs: 1_000 } });
    const channel = new ChannelPolicy();
    expect(channel.requireInvocation(connection, 'Catalog', { concurrent: 1, requestsInSecond: 1, quotaUsed: 0, at: watermark }, null)).toEqual({ deadlineMs: 500, attempts: 3 });
    expect(() => channel.requireInvocation(connection, 'Catalog', { concurrent: 2, requestsInSecond: 1, quotaUsed: 0, at: watermark }, null)).toThrow('CHANNEL_CONCURRENCY_LIMITED');
    const sync = new SyncPolicy();
    expect(() => sync.requireCheckpoint({ pulled: 1, accepted: 1, rejected: 0, phase: 'apply', cursor: 'a', watermark },
      { phase: 'apply', progress: { pulled: 2, accepted: 2, rejected: 0, phase: 'apply', cursor: 'b', watermark } })).toThrow('CHANNEL_SYNC_CURSOR_UNCOMMITTED');
    expect(sync.retry(new Error('PROVIDER_RESPONSE_TIMEOUT'), 1, 3)).toMatchObject({ retry: true, delayMs: 250,
      failure: { classification: 'timeout', retryable: true } });
  });
});
