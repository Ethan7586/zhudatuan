export type DistributorState = 'draft' | 'active' | 'suspended' | 'terminated';
export type BindingState = 'draft' | 'active' | 'expired' | 'terminated';

export interface DistributorSnapshot {
  readonly id: string;
  readonly organization: string;
  readonly code: string;
  readonly name: string;
  readonly settlementMode: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly state: DistributorState;
  readonly activeBindings: number;
  readonly hasContact: boolean;
  readonly version: number;
}

export class Distributor {
  constructor(readonly value: DistributorSnapshot) {
    if (!value.id.trim() || !value.organization.trim() || !/^[A-Za-z0-9][A-Za-z0-9.-]{1,63}$/.test(value.code) ||
      !value.name.trim() || !value.settlementMode.trim() || !Number.isSafeInteger(value.activeBindings) || value.activeBindings < 0 ||
      !Number.isSafeInteger(value.version) || value.version < 0) throw new Error('CHANNEL_DISTRIBUTOR_INVALID');
    if (value.state === 'terminated' && value.activeBindings !== 0) throw new Error('CHANNEL_DISTRIBUTOR_BINDING_ACTIVE');
    this.value = Object.freeze({ ...value, metadata: Object.freeze({ ...value.metadata }) });
    Object.freeze(this);
  }

  requireMutable(): void {
    if (this.value.state === 'terminated') throw new Error('CHANNEL_DISTRIBUTOR_TERMINATED');
  }

  requireTermination(): void {
    this.requireMutable();
    if (this.value.activeBindings !== 0) throw new Error('CHANNEL_DISTRIBUTOR_BINDING_ACTIVE');
  }
}

export interface BindingSnapshot {
  readonly id: string;
  readonly distributor: string;
  readonly tenant: string;
  readonly state: BindingState;
  readonly effectiveAt: string;
  readonly expiresAt: string | null;
  readonly version: number;
}

export class Binding {
  constructor(readonly value: BindingSnapshot) {
    const effective = Date.parse(value.effectiveAt);
    const expires = value.expiresAt === null ? null : Date.parse(value.expiresAt);
    if (!value.id.trim() || !value.distributor.trim() || !value.tenant.trim() || Number.isNaN(effective) ||
      expires !== null && (Number.isNaN(expires) || expires <= effective) || !Number.isSafeInteger(value.version) || value.version < 0) throw new Error('CHANNEL_BINDING_INVALID');
    this.value = Object.freeze({ ...value });
    Object.freeze(this);
  }
}
