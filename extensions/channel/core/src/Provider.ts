import type { ChannelProvider, ProviderHealth, ProviderManifest, ProviderPortName, ProviderPorts } from '@shop/contract';

export interface ProviderProbe {
  health(): Promise<boolean>;
  circuitState(): 'closed' | 'open' | 'halfopen';
}

export type ProviderHealthProbe = Pick<ProviderProbe, 'health'>;

export class Provider implements ChannelProvider {
  private running = false;

  constructor(
    readonly manifest: ProviderManifest,
    private readonly client: ProviderProbe,
    private readonly ports: Partial<ProviderPorts>
  ) {
    if (!manifest.signature.trim()) throw new Error('PROVIDER_SIGNATURE_MISSING');
    if (!Object.keys(ports).length) throw new Error('PROVIDER_PORTS_MISSING');
  }

  has<K extends ProviderPortName>(name: K): boolean {
    return this.ports[name] !== undefined;
  }

  require<K extends ProviderPortName>(name: K): ProviderPorts[K] {
    const port = this.ports[name];
    if (!port) throw new Error(`PROVIDER_CAPABILITY_MISSING:${name}`);
    return port as ProviderPorts[K];
  }

  async health(): Promise<ProviderHealth> {
    if (!this.running) return { state: 'unavailable', checkedAt: new Date().toISOString(), reason: 'PROVIDER_STOPPED' };
    const healthy = await this.client.health();
    return { state: healthy ? 'healthy' : 'degraded', checkedAt: new Date().toISOString(), ...(healthy ? {} : { reason: this.client.circuitState() === 'open' ? 'CIRCUIT_OPEN' : 'HEALTH_CHECK_FAILED' }) };
  }

  start(): Promise<void> {
    this.running = true;
    return Promise.resolve();
  }

  stop(): Promise<void> {
    this.running = false;
    return Promise.resolve();
  }
}
