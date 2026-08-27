import type { ProviderHealthState } from '@shop/contract';

export class HealthRecord {
  constructor(readonly installation: string, readonly version: number, readonly state: ProviderHealthState,
    readonly checkedAt: string, readonly latency: number, readonly reason?: string) {
    if (!installation || !Number.isSafeInteger(version) || version<0 || !Number.isSafeInteger(latency) || latency<0
      || Number.isNaN(Date.parse(checkedAt)) || (state==='healthy' && reason!==undefined)) throw new Error('EXTENSION_HEALTH_INVALID');
    Object.freeze(this);
  }
}
