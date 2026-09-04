export type EntitlementState = 'enabled' | 'disabled';

export interface EntitlementValues {
  readonly id: string;
  readonly scope: string;
  readonly capability: string;
  readonly state: EntitlementState;
  readonly quota: number | null;
  readonly effectiveAt: Date;
  readonly expiresAt: Date | null;
  readonly version: number;
}

export class Entitlement {
  readonly id!: string;
  readonly scope!: string;
  readonly capability!: string;
  readonly state!: EntitlementState;
  readonly quota!: number | null;
  readonly effectiveAt!: Date;
  readonly expiresAt!: Date | null;
  readonly version!: number;

  constructor(values: EntitlementValues) {
    if (!values.id || !values.scope || !values.capability || !Number.isSafeInteger(values.version) || values.version < 0) throw new Error('CAPABILITY_ENTITLEMENT_INVALID');
    if (values.quota !== null && (!Number.isSafeInteger(values.quota) || values.quota < 0)) throw new Error('CAPABILITY_QUOTA_INVALID');
    if (Number.isNaN(values.effectiveAt.getTime()) || (values.expiresAt !== null && Number.isNaN(values.expiresAt.getTime()))) throw new Error('CAPABILITY_TIME_INVALID');
    if (values.expiresAt !== null && values.expiresAt <= values.effectiveAt) throw new Error('CAPABILITY_EXPIRY_INVALID');
    Object.assign(this, values);
  }

  active(at: Date): boolean {
    return this.effectiveAt <= at && (this.expiresAt === null || this.expiresAt > at);
  }

  sameConfiguration(state: EntitlementState, quota: number | null, expiresAt: Date | null): boolean {
    return this.state === state && this.quota === quota && this.expiresAt?.getTime() === expiresAt?.getTime();
  }

  reconfigure(state: EntitlementState, quota: number | null, expiresAt: Date | null, at: Date): Entitlement {
    return new Entitlement({ id: this.id, scope: this.scope, capability: this.capability, state, quota, effectiveAt: at, expiresAt, version: this.version + 1 });
  }

  static create(input: Readonly<{ id: string; scope: string; capability: string; state: EntitlementState; quota: number | null; expiresAt: Date | null; at: Date }>): Entitlement {
    return new Entitlement({ ...input, effectiveAt: input.at, version: 1 });
  }
}
