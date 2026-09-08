import { DomainError } from '../../../../platform/error/DomainError';

export type PreauthPurpose = 'federationselection' | 'invitationproof' | 'enrollment';
export class Preauth {
  readonly id: string;
  readonly purpose: PreauthPurpose;
  readonly target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier';
  readonly principal: string | null;
  readonly reference: string;
  readonly version: number;
  readonly expiresAt: Date;

  constructor(value: Readonly<{ id: string; purpose: PreauthPurpose; target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier'; principal: string | null; reference: string; version: number; expiresAt: Date }>) {
    if (!value.id || !value.reference || !Number.isSafeInteger(value.version) || value.version < 0 || !Number.isFinite(value.expiresAt.getTime())) throw new DomainError('INTERNAL_ERROR');
    this.id = value.id;
    this.purpose = value.purpose;
    this.target = value.target;
    this.principal = value.principal;
    this.reference = value.reference;
    this.version = value.version;
    this.expiresAt = value.expiresAt;
    Object.freeze(this);
  }
}
