import { DomainError } from '../../../../platform/error/DomainError';

export type TrustedDeviceState = 'trusted' | 'blocked' | 'retired';

export class TrustedDevice {
  readonly value: Readonly<{ id: string; scope: string; label: string; fingerprintHash: string; publicKey: string | null; state: TrustedDeviceState; version: number }>;

  constructor(value: TrustedDevice['value']) {
    if (!value.id || !value.scope || value.label.trim().length < 1 || value.label.length > 120 || !/^[a-f0-9]{64}$/.test(value.fingerprintHash)) invalid();
    if (!['trusted', 'blocked', 'retired'].includes(value.state) || !Number.isSafeInteger(value.version) || value.version < 0) invalid();
    if (value.publicKey !== null && value.publicKey.length > 8192) invalid();
    this.value = Object.freeze({ ...value, label: value.label.trim() });
  }

  revise(change: Readonly<{ label: string; fingerprintHash: string; publicKey: string | null; state: TrustedDeviceState }>, expectedVersion: number): TrustedDevice {
    if (expectedVersion !== this.value.version || this.value.state === 'retired') throw new DomainError('VERSION_CONFLICT');
    return new TrustedDevice({ ...this.value, ...change, version: this.value.version + 1 });
  }
}

function invalid(): never {
  throw new DomainError('VALIDATION_FAILED');
}
