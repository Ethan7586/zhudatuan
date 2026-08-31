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

const transitions: Readonly<Record<ConnectionState, readonly ConnectionState[]>> = Object.freeze({
  draft: ['testing', 'disabled'],
  testing: ['enabled', 'degraded', 'disabled'],
  enabled: ['degraded', 'disabled'],
  degraded: ['testing', 'enabled', 'disabled'],
  disabled: ['testing'],
});

export class Connection {
  constructor(
    readonly id: string,
    readonly provider: string,
    readonly scope: string,
    readonly state: ConnectionState,
    readonly region: string,
    readonly limits: ConnectionLimits,
    readonly version: number
  ) {
    if (!id || !provider || !scope || !region || !Number.isSafeInteger(version) || version < 0) throw new Error('CHANNEL_CONNECTION_INVALID');
  }

  canMoveTo(target: ConnectionState): boolean {
    return transitions[this.state].includes(target);
  }

  requireTransition(target: ConnectionState): void {
    if (!this.canMoveTo(target)) throw new Error(`CONNECTION_TRANSITION_INVALID:${this.state}:${target}`);
  }
}
