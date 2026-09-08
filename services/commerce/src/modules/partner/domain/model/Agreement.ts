import { DomainError } from '../../../../platform/error/DomainError';

export class Agreement {
  readonly contractRef: string;
  readonly contractHash: string;
  readonly capabilities: readonly string[];
  readonly effectiveAt: Date;
  readonly expiresAt: Date;

  constructor(input: Readonly<{ contractRef: string; contractHash: string; capabilities: readonly string[]; effectiveAt: string; expiresAt: string }>) {
    this.contractRef = input.contractRef.trim();
    this.contractHash = input.contractHash.toLowerCase();
    this.capabilities = Object.freeze([...new Set(input.capabilities.map((value) => value.trim()))].sort());
    this.effectiveAt = new Date(input.effectiveAt);
    this.expiresAt = new Date(input.expiresAt);
    if (
      this.contractRef.length < 2 ||
      this.contractRef.length > 128 ||
      !/^[0-9a-f]{64}$/.test(this.contractHash) ||
      this.capabilities.length === 0 ||
      this.capabilities.length > 64 ||
      this.capabilities.some((value) => !/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/.test(value)) ||
      !Number.isFinite(this.effectiveAt.getTime()) ||
      !Number.isFinite(this.expiresAt.getTime()) ||
      this.expiresAt <= this.effectiveAt
    ) {
      throw new DomainError('PARTNER_AGREEMENT_PERIOD_INVALID');
    }
  }

  state(now: Date): 'active' | 'expired' {
    return now < this.expiresAt ? 'active' : 'expired';
  }
}
