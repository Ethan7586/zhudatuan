import { DomainError } from '../../../../platform/error/DomainError';
import type { IdentityProviderType } from '@shop/config/server';

export interface FederatedSubjectValue {
  readonly provider: IdentityProviderType;
  readonly instance: string;
  readonly tenant: string;
  readonly subject: string;
  readonly assurance: number;
  readonly claims: Readonly<Record<string, string>>;
}

export class FederatedSubject implements FederatedSubjectValue {
  readonly provider;
  readonly instance;
  readonly tenant;
  readonly subject;
  readonly assurance;
  readonly claims;
  constructor(value: FederatedSubjectValue) {
    const subject = value.subject.normalize('NFKC').trim();
    if (!subject || subject.length > 512 || !value.tenant || value.tenant.length > 512 || !Number.isSafeInteger(value.assurance) || value.assurance < 1 || value.assurance > 3) invalid();
    const claims = Object.fromEntries(Object.entries(value.claims).filter(([key, item]) => ['displayname', 'email', 'phone', 'openid', 'unionid'].includes(key) && typeof item === 'string' && item.length <= 255));
    this.provider = value.provider;
    this.instance = value.instance;
    this.tenant = value.tenant;
    this.subject = subject;
    this.assurance = value.assurance;
    this.claims = Object.freeze(claims);
    Object.freeze(this);
  }
}
function invalid(): never {
  throw new DomainError('FEDERATION_CALLBACK_REJECTED');
}
