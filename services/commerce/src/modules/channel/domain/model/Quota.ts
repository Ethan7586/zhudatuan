export type QuotaState = 'enabled' | 'disabled';

export interface QuotaSnapshot {
  readonly id: string;
  readonly scope: string;
  readonly capability: string;
  readonly state: QuotaState;
  readonly limit: number | null;
  readonly effectiveAt: string;
  readonly expiresAt: string | null;
  readonly version: number;
}

export class Quota {
  constructor(readonly value: QuotaSnapshot) {
    const effective = Date.parse(value.effectiveAt);
    const expires = value.expiresAt === null ? null : Date.parse(value.expiresAt);
    if (
      !value.id.trim() ||
      !value.scope.trim() ||
      !/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/.test(value.capability) ||
      (value.limit !== null && (!Number.isSafeInteger(value.limit) || value.limit < 0)) ||
      Number.isNaN(effective) ||
      (expires !== null && (Number.isNaN(expires) || expires <= effective)) ||
      !Number.isSafeInteger(value.version) ||
      value.version < 0
    ) {
      throw new Error('CHANNEL_QUOTA_INVALID');
    }
    this.value = Object.freeze({ ...value });
    Object.freeze(this);
  }
}
