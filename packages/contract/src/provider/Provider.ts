import type { ProviderManifest } from './Manifest';
import type { ProviderPortName, ProviderPorts } from './Ports';

export type ProviderHealthState = 'healthy' | 'degraded' | 'unavailable';

export interface ProviderHealth {
  readonly state: ProviderHealthState;
  readonly checkedAt: string;
  readonly reason?: string;
}

export interface ChannelProvider {
  readonly manifest: ProviderManifest;
  has<K extends ProviderPortName>(name: K): boolean;
  require<K extends ProviderPortName>(name: K): ProviderPorts[K];
  health(): Promise<ProviderHealth>;
  start(): Promise<void>;
  stop(): Promise<void>;
}
