import type { ProviderHealthState } from '@shop/contract';

export class HealthRecord {
  constructor(
    readonly installation: string,
    readonly version: number,
    readonly state: ProviderHealthState,
    readonly checkedAt: string,
    readonly latency: number,
    readonly reason?: string
  ) {
    if (
      !installation ||
      !Number.isSafeInteger(version) ||
      version < 0 ||
      !['healthy', 'degraded', 'unavailable'].includes(state) ||
      !Number.isSafeInteger(latency) ||
      latency < 0 ||
      Number.isNaN(Date.parse(checkedAt)) ||
      (state === 'healthy' && reason !== undefined) ||
      (reason !== undefined && (!reason.trim() || reason.length > 100))
    )
      throw new Error('EXTENSION_HEALTH_INVALID');
    Object.freeze(this);
  }
}
