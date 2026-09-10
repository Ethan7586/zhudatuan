import { describe, expect, it } from 'vitest';
import { OperationPipeline } from './OperationPipeline';
import { DomainError } from '../platform/error/DomainError';
import { HttpStream } from '../platform/http/HttpStream';

describe('OperationPipeline redirect contract', () => {
  it('validates Location as the generated output and keeps the HTTP body empty', async () => {
    const pipeline = new OperationPipeline(
      { get: () => ({ handle: () => Promise.resolve({ status: 303, headers: { location: 'https://yengze.press/' } }) }) } as never,
      {
        authorize: () =>
          Promise.resolve({
            kind: 'preauth',
            id: 'selection:one',
            purpose: 'federationselection',
            target: 'storefront',
            principal: 'principal:one',
            reference: 'selection:one',
            version: 0,
            expires: new Date('2099-01-01T00:00:00.000Z'),
            trace: 'trace:one',
          }),
      } as never,
      { create: () => `public:${'a'.repeat(64)}` } as never,
      passthroughExecutor() as never
    );

    await expect(pipeline.execute('identity.federations.complete', request())).resolves.toEqual({ status: 303, body: undefined, headers: { location: 'https://yengze.press/' } });
  });

  it('rejects a redirect without Location before it reaches the HTTP boundary', async () => {
    const pipeline = new OperationPipeline(
      { get: () => ({ handle: () => Promise.resolve({ status: 303, headers: {} }) }) } as never,
      {
        authorize: () =>
          Promise.resolve({
            kind: 'preauth',
            id: 'selection:one',
            purpose: 'federationselection',
            target: 'storefront',
            principal: 'principal:one',
            reference: 'selection:one',
            version: 0,
            expires: new Date('2099-01-01T00:00:00.000Z'),
            trace: 'trace:one',
          }),
      } as never,
      { create: () => `public:${'a'.repeat(64)}` } as never,
      passthroughExecutor() as never
    );
    await expect(pipeline.execute('identity.federations.complete', request())).rejects.toBeDefined();
  });
});

describe('OperationPipeline error contract', () => {
  it('turns an allowed non-success operation reply into an application error before output validation', async () => {
    const pipeline = errorPipeline({ code: 'IDEMPOTENCY_REPLAY_FORBIDDEN' });
    await expect(pipeline.execute('identity.sessions.create', sessionRequest())).rejects.toMatchObject({
      code: 'IDEMPOTENCY_REPLAY_FORBIDDEN',
    });
  });

  it('conceals a reply whose code and status do not match the operation error contract', async () => {
    const pipeline = errorPipeline({ code: 'VALIDATION_FAILED' });
    await expect(pipeline.execute('identity.sessions.create', sessionRequest())).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });

  it('conceals a typed exception not declared by the operation error contract', async () => {
    const pipeline = new OperationPipeline(
      { get: () => ({ handle: () => Promise.reject(new DomainError('ACCESS_VERSION_STALE')) }) } as never,
      { authorize: () => Promise.resolve({ kind: 'anonymous', channel: 'public', target: 'storefront', trace: 'trace:anonymous' }) } as never,
      { create: () => `public:${'c'.repeat(64)}` } as never,
      passthroughExecutor() as never
    );
    await expect(pipeline.execute('identity.sessions.create', sessionRequest())).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});

describe('OperationPipeline output boundary', () => {
  it('normalizes database dates before validating a JSON contract without mutating the handler result', async () => {
    const updatedAt = new Date('2026-08-30T06:00:00.000Z');
    const createdAt = new Date('2026-08-29T06:00:00.000Z');
    const body = {
      items: [
        {
          id: 'store:one',
          scope: 'store:one',
          name: '测试门店',
          status: 'active',
          version: 0,
          mall: 'mall:one',
          regionCode: '310000',
          serviceRadiusMeters: 5_000,
          addressConfigured: true,
          createdAt,
          updatedAt,
        },
      ],
      count: 1,
    };
    const pipeline = new OperationPipeline(
      { get: () => ({ handle: () => Promise.resolve({ status: 200, body }) }) } as never,
      { authorize: () => Promise.resolve({ kind: 'anonymous', channel: 'public', target: 'console', trace: 'trace:anonymous' }) } as never,
      { create: () => `public:${'d'.repeat(64)}` } as never,
      passthroughExecutor() as never
    );

    const controller = new AbortController();
    await expect(
      pipeline.execute('organization.stores.read', {
        method: 'GET',
        path: '/api/v1/organizations/stores',
        headers: { 'x-client-target': 'console' },
        parameters: {},
        query: new URLSearchParams(),
        body: undefined,
        rawBody: '',
        deadline: Date.now() + 1_000,
        signal: controller.signal,
      })
    ).resolves.toEqual({
      status: 200,
      body: {
        items: [
          {
            id: 'store:one',
            scope: 'store:one',
            name: '测试门店',
            status: 'active',
            version: 0,
            mall: 'mall:one',
            regionCode: '310000',
            serviceRadiusMeters: 5_000,
            addressConfigured: true,
            createdAt: '2026-08-29T06:00:00.000Z',
            updatedAt: '2026-08-30T06:00:00.000Z',
          },
        ],
        count: 1,
      },
    });
    expect(body.items[0]?.updatedAt).toBe(updatedAt);
  });

  it('passes a declared stream through without JSON serialization or output parsing', async () => {
    const body = new HttpStream(async function* () {
      yield { id: 'event:one', event: 'support.ticket.updated', data: { version: 2 } };
    });
    const pipeline = new OperationPipeline(
      { get: () => ({ handle: () => Promise.resolve({ status: 200, body }) }) } as never,
      { authorize: () => Promise.resolve({ kind: 'anonymous', channel: 'public', target: 'console', trace: 'trace:anonymous' }) } as never,
      { create: () => `public:${'e'.repeat(64)}` } as never,
      passthroughExecutor() as never
    );

    await expect(pipeline.execute('support.events.read', streamRequest())).resolves.toEqual({ status: 200, body });
  });
});

function request() {
  const controller = new AbortController();
  return {
    method: 'POST',
    path: '/api/v1/identity/federations/selection',
    headers: { 'idempotency-key': 'selection:one', 'x-client-target': 'storefront' },
    parameters: {},
    query: new URLSearchParams(),
    body: { membershipid: 'membership:one' },
    rawBody: '{"membershipid":"membership:one"}',
    deadline: Date.now() + 1_000,
    signal: controller.signal,
  };
}

function errorPipeline(body: Readonly<Record<string, string>>) {
  return new OperationPipeline(
    { get: () => ({ handle: () => Promise.resolve({ status: 409, body }) }) } as never,
    { authorize: () => Promise.resolve({ kind: 'anonymous', channel: 'public', target: 'storefront', trace: 'trace:anonymous' }) } as never,
    { create: () => `public:${'c'.repeat(64)}` } as never,
    passthroughExecutor() as never
  );
}

function passthroughExecutor() {
  return {
    execute: (handler: { handle(input: unknown, context: unknown): Promise<unknown> }, input: unknown, context: unknown) => handler.handle(input, context),
  };
}

function sessionRequest() {
  const controller = new AbortController();
  return {
    method: 'POST',
    path: '/api/v1/identity/sessions',
    headers: { 'idempotency-key': 'login:one', 'x-client-target': 'storefront' },
    parameters: {},
    query: new URLSearchParams(),
    body: { method: 'password', subject: 'ethan', password: 'secret', target: 'storefront', returnTarget: 'signed-target', authorization: { state: 'state', nonce: 'nonce', challenge: 'challenge' } },
    rawBody: '{}',
    deadline: Date.now() + 1_000,
    signal: controller.signal,
  };
}

function streamRequest() {
  const controller = new AbortController();
  return {
    method: 'GET',
    path: '/api/v1/support/events',
    headers: { 'x-client-target': 'console', 'x-scope-hint': 'mall:one' },
    parameters: {},
    query: new URLSearchParams(),
    body: undefined,
    rawBody: '',
    deadline: Date.now() + 1_000,
    signal: controller.signal,
  };
}
