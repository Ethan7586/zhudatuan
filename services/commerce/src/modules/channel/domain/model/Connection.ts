import type { ProviderCapability } from '@shop/contract';
import { validateConnectionLimits } from '../policy/ChannelPolicy';

export type ConnectionState = 'draft' | 'testing' | 'enabled' | 'degraded' | 'disabled';

export interface ConnectionLimits {
  readonly connectionTimeoutMs: number;
  readonly responseTimeoutMs: number;
  readonly totalDeadlineMs: number;
  readonly maxConcurrency: number;
  readonly requestsPerSecond: number;
  readonly maxAttempts: number;
  readonly failureThreshold: number;
  readonly recoveryMs: number;
}

export interface ConnectionSnapshot {
  readonly id: string;
  readonly provider: string;
  readonly scope: string;
  readonly state: ConnectionState;
  readonly contractVersion: string;
  readonly capabilities: readonly ProviderCapability[];
  readonly secretRef: string | null;
  readonly region: string;
  readonly limits: ConnectionLimits;
  readonly version: number;
}

export class Connection {
  readonly id: string;
  readonly provider: string;
  readonly scope: string;
  readonly state: ConnectionState;
  readonly contractVersion: string;
  readonly capabilities: readonly ProviderCapability[];
  readonly secretRef: string | null;
  readonly region: string;
  readonly limits: ConnectionLimits;
  readonly version: number;

  constructor(value: ConnectionSnapshot) {
    if (
      !value.id.trim() ||
      !/^[a-z][a-z0-9]{1,63}$/.test(value.provider) ||
      !value.scope.trim() ||
      !value.region.trim() ||
      !/^[a-z][a-z0-9]*\.v[1-9][0-9]*$/.test(value.contractVersion) ||
      value.capabilities.length === 0 ||
      new Set(value.capabilities).size !== value.capabilities.length ||
      !Number.isSafeInteger(value.version) ||
      value.version < 0 ||
      (value.secretRef !== null && !/^[a-z0-9][a-z0-9/.-]{2,255}$/.test(value.secretRef))
    )
      throw new Error('CHANNEL_CONNECTION_INVALID');
    validateConnectionLimits(value.limits);
    this.id = value.id;
    this.provider = value.provider;
    this.scope = value.scope;
    this.state = value.state;
    this.contractVersion = value.contractVersion;
    this.capabilities = Object.freeze([...value.capabilities]);
    this.secretRef = value.secretRef;
    this.region = value.region;
    this.limits = Object.freeze({ ...value.limits });
    this.version = value.version;
    Object.freeze(this);
  }
}
