import { describe, expect, it, vi } from 'vitest';
import { IntentsCreateHandler } from '../application/handler/IntentsCreateHandler';

describe('payment intent creation', () => {
  it('takes the payable amount only from the Order snapshot and returns provider action', async () => {
    const prepare = vi.fn(async (_context, command) => {
      expect(command).toMatchObject({ order: 'order:one', orderNumber: 'SW-1', amountMinor: 12_300, currency: 'CNY', idempotency: 'request:one' });
      expect(command.tenders).toEqual([{ kind: 'wechat', reference: null, amountMinor: 12_300 }]);
      return { intent: 'intent:one', external: true, expiresAt: '2026-09-05T00:30:00.000Z' };
    });
    const continuation = { continue: vi.fn(async () => ({ status: 201, body: { intent: 'intent:one', parameters: { timeStamp: '1', nonceStr: 'n' } } })) };
    const handler = paymentHandler(prepare, continuation);
    const loaded = await handler.load(input(), readContext() as never);
    const prepared = await handler.prepare(input(), baseContext() as never, loaded);
    const committed = await handler.commit(input(), prepared, writeContext() as never);
    const final = await handler.finalize(input(), committed.checkpoint, baseContext() as never);
    expect(final).toEqual({ status: 201, body: { intentId: 'intent:one', orderId: 'order:one', paymentId: 'intent:one', state: 'pending', action: { timeStamp: '1', nonceStr: 'n' }, expiresAt: '2026-09-05T00:30:00.000Z', retryAfter: 0 } });
  });

  it('rejects cancelled orders before creating an intent or calling a provider', async () => {
    const prepare = vi.fn();
    const gateways = { require: vi.fn() };
    const handler = paymentHandler(prepare, { continue: vi.fn() }, { lifecycleState: 'cancelled' }, gateways);
    const loaded = await handler.load(input(), readContext() as never);
    await expect(handler.prepare(input(), baseContext() as never, loaded)).rejects.toThrow('PAYMENT_INTENT_NOT_PAYABLE');
    expect(prepare).not.toHaveBeenCalled();
    expect(gateways.require).not.toHaveBeenCalled();
  });
});

function paymentHandler(
  prepare: ReturnType<typeof vi.fn>,
  continuation: Readonly<{ continue: ReturnType<typeof vi.fn> }>,
  override: Readonly<Record<string, unknown>> = {},
  gateways = { require: vi.fn(() => ({ application: vi.fn(() => ({ scene: 'miniapp', applicationHash: 'a'.repeat(64) })) })) }
) {
  return new IntentsCreateHandler(
    { member: vi.fn(async () => 'member:one') },
    { payment: vi.fn(async () => ({ id: 'order:one', number: 'SW-1', scope: 'mall:one', mall: 'mall:one', member: 'member:one', currency: 'CNY', totalMinor: 12_300, paymentState: 'unpaid', lifecycleState: 'created', ...override })) },
    { prepare } as never,
    gateways as never,
    continuation as never
  );
}

function input() {
  return { body: { order: 'order:one', scene: 'miniapp' } } as never;
}
function access() {
  return { kind: 'session', access: { actor: { id: 'principal:one' }, membership: { id: 'membership:one' }, scope: { id: 'owner:one' }, trace: 'trace:one' } };
}
function baseContext() {
  return {
    requestId: 'request:one',
    traceId: 'trace:one',
    deadline: Date.now() + 10_000,
    signal: new AbortController().signal,
    operation: 'payment.intents.create',
    security: access(),
    headers: {},
    rawBody: '{}',
    idempotencyKey: 'request:one',
  };
}
function readContext() {
  return { ...baseContext(), transaction: {} };
}
function writeContext() {
  return { ...baseContext(), transaction: {} };
}
