import { DomainError } from '../../../../platform/error/DomainError';
import type { Organization, OrganizationStatus } from './Organization';
import { MallOpening, type MallOpeningValue } from './MallOpening';

export type MallDomain = Readonly<{ mode: 'platform' }> | Readonly<{ mode: 'custom'; customDomain: string }>;
export interface MallTheme {
  readonly preset: 'shop' | 'market' | 'governance';
  readonly primaryColor: string;
  readonly accentColor: string;
  readonly logoObjectRef: string | null;
  readonly faviconObjectRef: string | null;
}
export interface MallProfile {
  readonly code: string;
  readonly publicSlug: string;
  readonly brandName: string;
  readonly domain: MallDomain;
  readonly ownerMembershipId: string;
  readonly currency: string;
  readonly theme: MallTheme;
  readonly opening: MallOpeningValue;
}
export interface MallValue extends MallProfile {
  readonly organization: Organization;
  readonly version: number;
  readonly createdat: string;
  readonly updatedat: string;
}
export interface MallPatch {
  readonly name?: string;
  readonly brandName?: string;
  readonly domain?: MallDomain;
  readonly ownerMembershipId?: string;
  readonly timezone?: string;
  readonly currency?: string;
  readonly theme?: MallTheme;
  readonly opening?: MallOpeningValue;
  readonly status?: OrganizationStatus;
}

export class Mall implements MallValue {
  readonly organization: Organization;
  readonly code: string;
  readonly publicSlug: string;
  readonly brandName: string;
  readonly domain: MallDomain;
  readonly ownerMembershipId: string;
  readonly currency: string;
  readonly theme: MallTheme;
  readonly opening: MallOpeningValue;
  readonly version: number;
  readonly createdat: string;
  readonly updatedat: string;

  constructor(value: MallValue) {
    if (value.organization.kind !== 'mall' || value.organization.parentid === null) invalid('mallId');
    if (!/^[A-Z][A-Z0-9_]{1,31}$/.test(value.code)) invalid('code');
    if (!/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(value.publicSlug)) invalid('publicSlug');
    if (value.brandName.trim().length < 2 || value.brandName.trim().length > 120) invalid('brandName');
    validateDomain(value.domain);
    if (value.ownerMembershipId.trim().length < 3 || value.ownerMembershipId.trim().length > 160) invalid('ownerMembershipId');
    if (!/^[A-Z]{3}$/.test(value.currency)) invalid('currency');
    validateTheme(value.theme);
    const opening = new MallOpening(value.opening).view();
    if (!Number.isSafeInteger(value.version) || value.version < 1) invalid('version');
    if (!Number.isFinite(Date.parse(value.createdat)) || !Number.isFinite(Date.parse(value.updatedat)) || Date.parse(value.updatedat) < Date.parse(value.createdat)) invalid('updatedAt');
    this.organization = value.organization;
    this.code = value.code;
    this.publicSlug = value.publicSlug;
    this.brandName = value.brandName.trim();
    this.domain = Object.freeze({ ...value.domain });
    this.ownerMembershipId = value.ownerMembershipId.trim();
    this.currency = value.currency;
    this.theme = Object.freeze({ ...value.theme });
    this.opening = opening;
    this.version = value.version;
    this.createdat = value.createdat;
    this.updatedat = value.updatedat;
    Object.freeze(this);
  }

  revise(patch: MallPatch, organization: Organization, now: string): Mall {
    return new Mall({
      organization,
      code: this.code,
      publicSlug: this.publicSlug,
      brandName: patch.brandName ?? this.brandName,
      domain: patch.domain ?? this.domain,
      ownerMembershipId: patch.ownerMembershipId ?? this.ownerMembershipId,
      currency: patch.currency ?? this.currency,
      theme: patch.theme ?? this.theme,
      opening: patch.opening ?? this.opening,
      version: this.version + 1,
      createdat: this.createdat,
      updatedat: now,
    });
  }

  view(): Readonly<Record<string, unknown>> {
    return Object.freeze({
      id: this.organization.id,
      parentId: this.organization.parentid,
      name: this.organization.name,
      code: this.code,
      publicSlug: this.publicSlug,
      brandName: this.brandName,
      domain: this.domain,
      ownerMembershipId: this.ownerMembershipId,
      timezone: this.organization.timezone,
      currency: this.currency,
      theme: this.theme,
      opening: this.opening,
      status: this.organization.status,
      version: this.version,
      createdAt: this.createdat,
      updatedAt: this.updatedat,
    });
  }
}

function validateDomain(value: MallDomain): void {
  if (value.mode === 'platform') return;
  if (!/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(value.customDomain) || value.customDomain !== value.customDomain.toLowerCase()) invalid('customDomain');
}

function validateTheme(value: MallTheme): void {
  if (!['shop', 'market', 'governance'].includes(value.preset)) invalid('theme');
  if (!/^#[0-9A-F]{6}$/.test(value.primaryColor) || !/^#[0-9A-F]{6}$/.test(value.accentColor)) invalid('theme');
  for (const asset of [value.logoObjectRef, value.faviconObjectRef]) if (asset !== null && (asset.length < 3 || asset.length > 512 || !/^[a-z][a-z0-9]*:[A-Za-z0-9][A-Za-z0-9.:/-]*$/.test(asset))) invalid('theme');
}

function invalid(field: string): never {
  throw new DomainError('VALIDATION_FAILED', { field });
}
