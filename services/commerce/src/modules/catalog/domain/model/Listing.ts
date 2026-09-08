import { DomainError } from '../../../../platform/error/DomainError';
import type { ListingEligibilityDecision } from '../policy/ListingEligibility';

export type ListingState = 'draft' | 'published' | 'unpublished' | 'retired';

export interface ListingSnapshot {
  readonly id: string;
  readonly scope: string;
  readonly pool: string | null;
  readonly sku: string;
  readonly title: string;
  readonly state: ListingState;
  readonly effectiveAt: string | null;
  readonly expiresAt: string | null;
  readonly version: number;
}

export class Listing {
  private constructor(private readonly value: ListingSnapshot) {
    validate(value);
    Object.freeze(this);
  }

  static draft(input: Omit<ListingSnapshot, 'state' | 'effectiveAt' | 'expiresAt' | 'version'>): Listing {
    return new Listing(Object.freeze({ ...input, title: input.title.trim(), state: 'draft', effectiveAt: null, expiresAt: null, version: 1 }));
  }

  static restore(value: ListingSnapshot): Listing {
    return new Listing(Object.freeze({ ...value }));
  }

  publish(expectedVersion: number, eligibility: ListingEligibilityDecision, now: string): Listing {
    this.expect(expectedVersion);
    if (this.value.state === 'retired') throw new DomainError('LISTING_NOT_PURCHASABLE', { reason: 'LISTING_RETIRED' });
    if (!eligibility.eligible) throw new DomainError('LISTING_NOT_PURCHASABLE', { reason: eligibility.gaps[0] ?? 'DEPENDENCY_UNAVAILABLE', gaps: eligibility.gaps });
    return new Listing(Object.freeze({ ...this.value, state: 'published', effectiveAt: now, expiresAt: null, version: this.value.version + 1 }));
  }

  unpublish(expectedVersion: number, now: string): Listing {
    this.expect(expectedVersion);
    if (this.value.state === 'retired') throw new DomainError('LISTING_NOT_PURCHASABLE', { reason: 'LISTING_RETIRED' });
    return new Listing(Object.freeze({ ...this.value, state: 'unpublished', expiresAt: now, version: this.value.version + 1 }));
  }

  snapshot(): ListingSnapshot {
    return this.value;
  }

  private expect(expectedVersion: number): void {
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion !== this.value.version) throw new DomainError('VERSION_CONFLICT');
  }
}

function validate(value: ListingSnapshot): void {
  if (!/^listing:[A-Za-z0-9][A-Za-z0-9.:/-]*$/.test(value.id) || !/^sku:/.test(value.sku)) invalid('listing');
  if (!value.scope || (value.pool !== null && !/^pool:/.test(value.pool))) invalid('scope');
  if (value.title.length < 1 || value.title.length > 300) invalid('title');
  if (!['draft', 'published', 'unpublished', 'retired'].includes(value.state)) invalid('state');
  if (!Number.isSafeInteger(value.version) || value.version < 1) invalid('version');
  if (value.effectiveAt !== null && Number.isNaN(Date.parse(value.effectiveAt))) invalid('effectiveAt');
  if (value.expiresAt !== null && Number.isNaN(Date.parse(value.expiresAt))) invalid('expiresAt');
}

function invalid(field: string): never {
  throw new DomainError('VALIDATION_FAILED', { field });
}
