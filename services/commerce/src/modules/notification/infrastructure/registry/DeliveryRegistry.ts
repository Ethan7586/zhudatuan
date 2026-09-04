import { token } from '../../../../bootstrap/Container';
import type { DeliveryChannel } from '../../application/port/DeliveryChannel';
import type { DeliveryResolver, DeliveryStrategy } from '../../application/port/DeliveryResolver';

export class DeliveryRegistry implements DeliveryResolver {
  private readonly channels: Map<string, DeliveryRoute[]>;

  constructor(channels: readonly DeliveryChannel[]) {
    const grouped = new Map<string, DeliveryRoute[]>();
    channels.forEach((channel, index) => {
      const source = channel as DeliveryChannel & Readonly<{ provider?: unknown; priority?: unknown }>;
      const provider = typeof source.provider === 'string' && /^[a-z][a-z0-9.-]{1,63}$/.test(source.provider) ? source.provider : `${channel.id}.${index + 1}`;
      const priority = Number.isSafeInteger(source.priority) && Number(source.priority) >= 0 ? Number(source.priority) : 100;
      const strategies = grouped.get(channel.id) ?? [];
      if (strategies.some((strategy) => strategy.provider === provider)) throw new Error(`DELIVERY_STRATEGY_DUPLICATE:${channel.id}:${provider}`);
      strategies.push(new DeliveryRoute(channel, provider, priority));
      grouped.set(channel.id, strategies);
    });
    this.channels = new Map([...grouped].map(([id, strategies]) => [id, strategies.sort(compare)]));
  }

  resolve(id: string): readonly DeliveryStrategy[] {
    const strategies = this.channels.get(id);
    if (!strategies?.length) throw new Error(`DELIVERY_CHANNEL_UNAVAILABLE:${id}`);
    return Object.freeze(strategies.map((strategy) => strategy.contract));
  }

  has(provider: string): boolean {
    return [...this.channels.values()].some((strategies) => strategies.some((strategy) => strategy.provider === provider));
  }

  async disable(provider: string, deadline = Date.now() + 30_000): Promise<Readonly<{ drained: boolean; active: number }>> {
    const disabled: DeliveryRoute[] = [];
    for (const [channel, strategies] of this.channels) {
      const retained = strategies.filter((strategy) => {
        if (strategy.provider !== provider) return true;
        strategy.close();
        disabled.push(strategy);
        return false;
      });
      if (retained.length) this.channels.set(channel, retained);
      else this.channels.delete(channel);
    }
    const drained = (await Promise.all(disabled.map((strategy) => strategy.drain(deadline)))).every(Boolean);
    return Object.freeze({ drained, active: disabled.reduce((total, strategy) => total + strategy.active, 0) });
  }
}

class DeliveryRoute {
  private accepting = true;
  private running = 0;
  private readonly waiters = new Set<() => void>();
  readonly contract: DeliveryStrategy;

  constructor(
    private readonly channel: DeliveryChannel,
    readonly provider: string,
    readonly priority: number
  ) {
    this.contract = Object.freeze({ channel: channel.id, provider, priority,
      send: (request: Parameters<DeliveryChannel['send']>[0]) => this.invoke(request) });
  }

  get active(): number { return this.running; }

  close(): void { this.accepting = false; }

  async drain(deadline: number): Promise<boolean> {
    if (this.running === 0) return true;
    return new Promise<boolean>((resolve) => {
      let timer: ReturnType<typeof setTimeout>;
      const finish = (drained: boolean) => {
        clearTimeout(timer);
        this.waiters.delete(onDrain);
        resolve(drained);
      };
      const onDrain = () => finish(true);
      this.waiters.add(onDrain);
      timer = setTimeout(() => finish(false), Math.max(1, deadline - Date.now()));
      timer.unref?.();
    });
  }

  private async invoke(request: Parameters<DeliveryChannel['send']>[0]) {
    if (!this.accepting) throw new Error(`DELIVERY_PROVIDER_DRAINING:${this.provider}`);
    this.running += 1;
    try {
      return await this.channel.send(request);
    } finally {
      this.running -= 1;
      if (this.running === 0) for (const waiter of [...this.waiters]) waiter();
    }
  }
}

function compare(left: DeliveryRoute, right: DeliveryRoute): number {
  return left.priority - right.priority || left.provider.localeCompare(right.provider);
}

export const DELIVERY_REGISTRY = token<DeliveryRegistry>('notification.deliveries');
