import { DomainError } from '../../../../foundation/domain/DomainError';

export type PreauthPurpose = 'federationselection' | 'invitationproof' | 'enrollment';
export class Preauth {
  readonly id: string;
  readonly purpose: PreauthPurpose;
  readonly target: 'console' | 'storefront';
  readonly principal: string | null;
  readonly reference: string;
  readonly version: number;
  readonly expiresAt: Date;

  constructor(value: Readonly<{ id: string; purpose: PreauthPurpose; target: 'console' | 'storefront'; principal: string | null; reference: string; version: number; expiresAt: Date }>) {
    if (!value.id || !value.reference || !Number.isSafeInteger(value.version) || value.version < 0 || !Number.isFinite(value.expiresAt.getTime())) throw new DomainError('AUTHENTICATION_REQUIRED');
    this.id = value.id;
    this.purpose = value.purpose;
    this.target = value.target;
    this.principal = value.principal;
    this.reference = value.reference;
    this.version = value.version;
    this.expiresAt = value.expiresAt;
    Object.freeze(this);
  }

  assertActive(now: Date, purpose: PreauthPurpose, target: 'console' | 'storefront'): void {
    if (this.expiresAt <= now || this.purpose !== purpose || this.target !== target) throw new DomainError('AUTHENTICATION_REQUIRED');
  }
}
