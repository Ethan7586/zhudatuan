import { DomainError } from '../../../../foundation/domain/DomainError';

export class Session {
  readonly id: string;
  readonly principal: string;
  readonly membership: string;
  readonly credentialVersion: number;
  readonly accessVersion: number;
  readonly target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier';
  readonly assurance: 1 | 2 | 3;
  readonly expiresAt: Date;

  constructor(value: Readonly<{ id: string; principal: string; membership: string; credentialVersion: number; accessVersion: number; target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier'; assurance: 1 | 2 | 3; expiresAt: Date }>) {
    if (
      !value.id ||
      !value.principal ||
      !value.membership ||
      !Number.isSafeInteger(value.credentialVersion) ||
      value.credentialVersion < 0 ||
      !Number.isSafeInteger(value.accessVersion) ||
      value.accessVersion < 0 ||
      !Number.isFinite(value.expiresAt.getTime())
    )
      throw new DomainError('MEMBERSHIP_SELECTION_REQUIRED');
    this.id = value.id;
    this.principal = value.principal;
    this.membership = value.membership;
    this.credentialVersion = value.credentialVersion;
    this.accessVersion = value.accessVersion;
    this.target = value.target;
    this.assurance = value.assurance;
    this.expiresAt = value.expiresAt;
    Object.freeze(this);
  }

  ttlSeconds(now: Date): number {
    const seconds = Math.floor((this.expiresAt.getTime() - now.getTime()) / 1000);
    if (seconds < 1) throw new DomainError('AUTHENTICATION_REQUIRED');
    return seconds;
  }
}
