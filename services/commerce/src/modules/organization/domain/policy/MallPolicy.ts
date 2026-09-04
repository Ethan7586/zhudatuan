import { DomainError } from '../../../../foundation/domain/DomainError';
import type { MallDomain, MallProfile, MallTheme } from '../model/Mall';
import { MallOpening } from '../model/MallOpening';

export class MallPolicy {
  profile(input: MallProfile): MallProfile {
    const domain = normalizeDomain(input.domain);
    const theme = normalizeTheme(input.theme);
    const opening = new MallOpening(input.opening).view();
    if (opening.state !== 'complete') invalid('opening');
    const profile = Object.freeze({
      code: input.code.trim().toUpperCase(),
      publicSlug: input.publicSlug.trim().toLowerCase(),
      brandName: input.brandName.trim(),
      domain,
      ownerMembershipId: input.ownerMembershipId.trim(),
      currency: input.currency.trim().toUpperCase(),
      theme,
      opening,
    });
    if (!/^[A-Z][A-Z0-9_]{1,31}$/.test(profile.code)) invalid('code');
    if (!/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(profile.publicSlug)) invalid('publicSlug');
    if (profile.brandName.length < 2 || profile.brandName.length > 120) invalid('brandName');
    if (profile.ownerMembershipId.length < 3 || profile.ownerMembershipId.length > 160) invalid('ownerMembershipId');
    if (!/^[A-Z]{3}$/.test(profile.currency)) invalid('currency');
    return profile;
  }
}

function normalizeDomain(value: MallDomain): MallDomain {
  if (value.mode === 'platform') return Object.freeze({ mode: 'platform' });
  const customDomain = value.customDomain.trim().toLowerCase().replace(/\.$/, '');
  if (!/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(customDomain)) invalid('customDomain');
  return Object.freeze({ mode: 'custom', customDomain });
}

function normalizeTheme(value: MallTheme): MallTheme {
  const primaryColor = value.primaryColor.trim().toUpperCase();
  const accentColor = value.accentColor.trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(primaryColor) || !/^#[0-9A-F]{6}$/.test(accentColor)) invalid('theme');
  if (!['shop', 'market', 'governance'].includes(value.preset)) invalid('theme');
  return Object.freeze({ preset: value.preset, primaryColor, accentColor, logoObjectRef: asset(value.logoObjectRef), faviconObjectRef: asset(value.faviconObjectRef) });
}

function asset(value: string | null): string | null {
  if (value === null) return null;
  const normalized = value.trim();
  if (normalized.length < 3 || normalized.length > 512 || !/^[a-z][a-z0-9]*:[A-Za-z0-9][A-Za-z0-9.:/-]*$/.test(normalized)) invalid('theme');
  return normalized;
}

function invalid(field: string): never {
  throw new DomainError('VALIDATION_FAILED', { field });
}
