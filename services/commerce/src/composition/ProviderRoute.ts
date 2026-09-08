import type { ChannelProvider, ProviderPortName, ProviderPorts } from '@shop/contract';

export class ProviderRoute {
  private accepting = true;
  private running = 0;
  private readonly waiters = new Set<() => void>();
  private readonly ports = new Map<ProviderPortName, unknown>();

  constructor(private readonly provider: ChannelProvider) {}

  get active(): number {
    return this.running;
  }

  strategy<K extends ProviderPortName>(name: K): ProviderPorts[K] {
    const cached = this.ports.get(name);
    if (cached) return cached as ProviderPorts[K];
    const target = this.provider.require(name);
    const routed = new Proxy(target as object, {
      get: (value, property) => {
        const member = Reflect.get(value, property);
        return typeof member === 'function' ? (...arguments_: readonly unknown[]) => this.invoke(() => Reflect.apply(member, value, arguments_)) : member;
      },
    }) as ProviderPorts[K];
    this.ports.set(name, routed);
    return routed;
  }

  close(): void {
    this.accepting = false;
  }

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

  private async invoke<T>(work: () => T | Promise<T>): Promise<T> {
    if (!this.accepting) throw new Error('EXTENSION_DRAINING:' + this.provider.manifest.id);
    this.running += 1;
    try {
      return await work();
    } finally {
      this.running -= 1;
      if (this.running === 0) for (const waiter of [...this.waiters]) waiter();
    }
  }
}
