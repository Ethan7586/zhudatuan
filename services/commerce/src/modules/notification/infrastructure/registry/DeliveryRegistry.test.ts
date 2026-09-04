import type { DeliveryChannel } from '../../application/port/DeliveryChannel';
import { describe, expect, it, vi } from 'vitest';
import { DeliveryRegistry } from './DeliveryRegistry';

describe('delivery strategy registry', () => {
  it('orders interchangeable providers by explicit priority', () => {
    const registry = new DeliveryRegistry([
      strategy('email', 'secondary', 20),
      strategy('email', 'primary', 10),
      strategy('sms', 'sms', 1),
    ]);
    expect(registry.resolve('email').map(({ provider }) => provider)).toEqual(['primary', 'secondary']);
  });

  it('rejects duplicate provider registrations and unavailable channels', () => {
    expect(() => new DeliveryRegistry([strategy('email', 'mail', 1), strategy('email', 'mail', 2)])).toThrow('DELIVERY_STRATEGY_DUPLICATE:email:mail');
    expect(() => new DeliveryRegistry([]).resolve('wechat')).toThrow('DELIVERY_CHANNEL_UNAVAILABLE:wechat');
  });

  it('removes one provider before draining its in-flight delivery and leaves the fallback route available', async () => {
    let release!: () => void;
    const running = new Promise<Readonly<{ provider: string; externalId: string }>>((resolve) => {
      release = () => resolve({ provider: 'primary', externalId: 'message:one' });
    });
    const primary = strategy('email', 'primary', 1, () => running);
    const secondary = strategy('email', 'secondary', 2, async () => ({ provider: 'secondary', externalId: 'message:two' }));
    const registry = new DeliveryRegistry([primary, secondary]);
    const selected = registry.resolve('email')[0]!;
    const delivery = selected.send(request());
    const disabling = registry.disable('primary', Date.now() + 1_000);
    expect(registry.has('primary')).toBe(false);
    expect(registry.resolve('email').map(({ provider }) => provider)).toEqual(['secondary']);
    await expect(selected.send(request())).rejects.toThrow('DELIVERY_PROVIDER_DRAINING:primary');
    release();
    await expect(delivery).resolves.toMatchObject({ provider: 'primary' });
    await expect(disabling).resolves.toEqual({ drained: true, active: 0 });
  });
});

function strategy(id: DeliveryChannel['id'], provider: string, priority: number, send: DeliveryChannel['send'] = vi.fn()): DeliveryChannel {
  return { id, provider, priority, send } as unknown as DeliveryChannel;
}

function request() {
  return { recipient: 'member@example.test', providerTemplate: 'paid', purpose: 'transactional' as const, variables: {}, subject: '通知', body: '正文', idempotency: 'dispatch:one' };
}
