import { DomainError } from '../../../../platform/error/DomainError';
import { isOrganizationReference } from '@shop/kernel';
import type { IdentityProviderType } from '@shop/config/server';

export type ProviderStatus = 'draft' | 'enabled' | 'disabled' | 'revoked';

export interface ProviderInstanceValue {
  readonly id: string;
  readonly type: IdentityProviderType;
  readonly tenantid: string;
  readonly issuer: string | null;
  readonly clientid: string;
  readonly secretref: string;
  readonly status: ProviderStatus;
  readonly redirecturi: string;
  readonly scopes: readonly string[];
  readonly version: number;
  readonly createdat: string;
  readonly updatedat: string;
}

export class ProviderInstance implements ProviderInstanceValue {
  readonly id: string;
  readonly type: IdentityProviderType;
  readonly tenantid: string;
  readonly issuer: string | null;
  readonly clientid: string;
  readonly secretref: string;
  readonly status: ProviderStatus;
  readonly redirecturi: string;
  readonly scopes: readonly string[];
  readonly version: number;
  readonly createdat: string;
  readonly updatedat: string;
  constructor(value: ProviderInstanceValue) {
    if (!/^[0-9a-f-]{36}$/.test(value.id) || !isOrganizationReference(value.tenantid)) invalid();
    if (!['wechat', 'wecomcorp', 'wecomsuite', 'oidc'].includes(value.type)) invalid();
    if (!/^[a-z][a-z0-9./]{2,127}$/.test(value.secretref) || value.clientid.length < 1 || value.clientid.length > 255) invalid();
    const redirect = new URL(value.redirecturi);
    if (redirect.protocol !== 'https:' || redirect.username || redirect.password || redirect.search || redirect.hash) invalid();
    if (value.issuer !== null) {
      const issuer = new URL(value.issuer);
      if (issuer.protocol !== 'https:' || issuer.username || issuer.password || issuer.search || issuer.hash) invalid();
    }
    if (!Number.isSafeInteger(value.version) || value.version < 0 || value.scopes.length > 32 || new Set(value.scopes).size !== value.scopes.length) invalid();
    this.id = value.id;
    this.type = value.type;
    this.tenantid = value.tenantid;
    this.issuer = value.issuer;
    this.clientid = value.clientid;
    this.secretref = value.secretref;
    this.status = value.status;
    this.redirecturi = value.redirecturi;
    this.scopes = Object.freeze([...value.scopes]);
    this.version = value.version;
    this.createdat = value.createdat;
    this.updatedat = value.updatedat;
    Object.freeze(this);
  }
  enabled(): boolean {
    return this.status === 'enabled';
  }
}
function invalid(): never {
  throw new DomainError('IDENTITY_PROVIDER_CONFIGURATION_INVALID');
}
