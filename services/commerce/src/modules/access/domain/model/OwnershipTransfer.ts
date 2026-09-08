import { DomainError } from '../../../../platform/error/DomainError';

export type OwnershipTransferState = 'draft' | 'pending' | 'accepted' | 'cancelled' | 'expired';
export type FormerOwnerMode = 'retain_admin' | 'remove_admin';

export interface OwnershipTransferValue {
  readonly id: string;
  readonly scope: string;
  readonly role: string;
  readonly sourceMembership: string;
  readonly targetMembership: string;
  readonly formerOwnerMode: FormerOwnerMode;
  readonly formerOwnerRole: string | null;
  readonly formerOwnerRoleVersion: number | null;
  readonly ownershipVersion: number;
  readonly targetAccessVersion: number;
  readonly sourceProof: string | null;
  readonly targetProof: string | null;
  readonly cancelProof: string | null;
  readonly state: OwnershipTransferState;
  readonly version: number;
  readonly coolingUntil: Date;
  readonly expiresAt: Date;
}

export class OwnershipTransfer implements OwnershipTransferValue {
  readonly id!: string;
  readonly scope!: string;
  readonly role!: string;
  readonly sourceMembership!: string;
  readonly targetMembership!: string;
  readonly formerOwnerMode!: FormerOwnerMode;
  readonly formerOwnerRole!: string | null;
  readonly formerOwnerRoleVersion!: number | null;
  readonly ownershipVersion!: number;
  readonly targetAccessVersion!: number;
  readonly sourceProof!: string | null;
  readonly targetProof!: string | null;
  readonly cancelProof!: string | null;
  readonly state!: OwnershipTransferState;
  readonly version!: number;
  readonly coolingUntil!: Date;
  readonly expiresAt!: Date;

  constructor(value: OwnershipTransferValue) {
    if (
      !/^ownershiptransfer:[A-Za-z0-9-]+$/.test(value.id) ||
      !value.scope ||
      !value.role ||
      !value.sourceMembership ||
      !value.targetMembership ||
      value.sourceMembership === value.targetMembership ||
      !['retain_admin', 'remove_admin'].includes(value.formerOwnerMode) ||
      (value.formerOwnerMode === 'retain_admin') !== (value.formerOwnerRole !== null) ||
      (value.formerOwnerMode === 'retain_admin') !== (value.formerOwnerRoleVersion !== null) ||
      (value.formerOwnerRoleVersion !== null && (!Number.isSafeInteger(value.formerOwnerRoleVersion) || value.formerOwnerRoleVersion < 1)) ||
      ![value.ownershipVersion, value.targetAccessVersion, value.version].every((item) => Number.isSafeInteger(item) && item > 0) ||
      !Number.isFinite(value.coolingUntil.getTime()) ||
      !Number.isFinite(value.expiresAt.getTime()) ||
      value.coolingUntil >= value.expiresAt ||
      !proofStateValid(value)
    ) {
      throw new DomainError('OWNER_TRANSFER_INVALID');
    }
    Object.assign(this, { ...value, coolingUntil: new Date(value.coolingUntil), expiresAt: new Date(value.expiresAt) });
    Object.freeze(this);
  }

  current(now = new Date()): OwnershipTransfer {
    return this.state === 'pending' && now >= this.expiresAt ? this.with({ state: 'expired', version: this.version + 1 }) : this;
  }

  submit(sourceProof: string): OwnershipTransfer {
    if (this.state !== 'draft' || !proofHash(sourceProof)) throw new DomainError('OWNER_TRANSFER_STATE_INVALID');
    return this.with({ state: 'pending', sourceProof, version: this.version + 1 });
  }

  accept(actor: string, proof: string, now = new Date()): OwnershipTransfer {
    const active = this.current(now);
    if (active.state === 'expired') throw new DomainError('OWNER_TRANSFER_EXPIRED');
    if (now < active.coolingUntil) throw new DomainError('OWNER_TRANSFER_COOLING_PERIOD');
    if (active.state !== 'pending' || actor !== active.targetMembership || !proofHash(proof) || proof === active.sourceProof) throw new DomainError('OWNER_TRANSFER_STATE_INVALID');
    return active.with({ state: 'accepted', targetProof: proof, version: active.version + 1 });
  }

  cancel(actor: string, proof: string, now = new Date()): OwnershipTransfer {
    const active = this.current(now);
    if (active.state === 'expired') throw new DomainError('OWNER_TRANSFER_EXPIRED');
    if (active.state !== 'pending' || actor !== active.sourceMembership || !proofHash(proof)) throw new DomainError('OWNER_TRANSFER_STATE_INVALID');
    return active.with({ state: 'cancelled', cancelProof: proof, version: active.version + 1 });
  }

  private with(change: Partial<OwnershipTransferValue>): OwnershipTransfer {
    return new OwnershipTransfer({ ...this, ...change });
  }
}

function proofHash(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}

function proofStateValid(value: OwnershipTransferValue): boolean {
  const source = value.sourceProof !== null && proofHash(value.sourceProof);
  const target = value.targetProof !== null && proofHash(value.targetProof);
  const cancel = value.cancelProof !== null && proofHash(value.cancelProof);
  if (value.state === 'draft') return !source && !target && !cancel;
  if (value.state === 'pending' || value.state === 'expired') return source && !target && !cancel;
  if (value.state === 'accepted') return source && target && !cancel && value.sourceProof !== value.targetProof;
  return source && !target && cancel;
}
