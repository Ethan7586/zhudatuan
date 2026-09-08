import type { ProviderCallContext } from './Ports';

export type PurchasableMallLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

/** The organization owns the domain. A membership may authorize purchase but never becomes the owner. */
export interface DomainPurchaseOwner {
  readonly organizationId: string;
  readonly mallId: string;
  /** Must be resolved by the server from the organization tree, never trusted from a client body. */
  readonly resolvedLevel: PurchasableMallLevel;
}

export interface DomainQuoteRequest {
  readonly purchaseId: string;
  readonly owner: DomainPurchaseOwner;
  readonly domainAscii: string;
  readonly registrationYears: number;
}

interface DomainQuoteBase {
  readonly providerId: string;
  readonly quoteId: string;
  readonly domainAscii: string;
  readonly registrationYears: number;
  readonly checkedAt: string;
  readonly expiresAt: string;
}

export interface UnavailableDomainQuote extends DomainQuoteBase {
  readonly availability: 'unavailable';
}

export interface PurchasableDomainQuote extends DomainQuoteBase {
  readonly availability: 'available' | 'premium';
  readonly currency: string;
  readonly totalMinor: number;
}

export type DomainRegistrationQuote = UnavailableDomainQuote | PurchasableDomainQuote;

/** Immutable evidence that one membership approved one exact quote for one mall. */
export interface DomainPurchaseApproval {
  readonly approvalId: string;
  readonly purchaseId: string;
  readonly scopeId: string;
  readonly membershipId: string;
  readonly quoteFingerprint: string;
  readonly amountMinor: number;
  readonly currency: string;
  /** Existing Finance hold; the registrar must never charge without reserved funds. */
  readonly fundingHoldRef: string;
  readonly assuranceLevel: 2 | 3;
  readonly approvedAt: string;
}

export interface DomainPurchaseCommand {
  readonly purchaseId: string;
  readonly owner: DomainPurchaseOwner;
  readonly quote: PurchasableDomainQuote;
  /** Reference to encrypted registrant data; raw names, phones and identity numbers are forbidden here. */
  readonly registrantContactRef: string;
  readonly approval: DomainPurchaseApproval;
}

export interface DomainPurchaseCallContext extends ProviderCallContext {
  readonly idempotencyKey: string;
}

export type DomainRegistrationState = 'submitted' | 'registered' | 'failed';

export interface DomainRegistrationReceipt {
  readonly providerId: string;
  readonly externalReference: string;
  readonly domainAscii: string;
  readonly state: DomainRegistrationState;
  readonly submittedAt: string;
  readonly registeredAt?: string;
  readonly expiresAt?: string;
  readonly evidenceRef?: string;
}

export interface DomainRegistrationStatus extends DomainRegistrationReceipt {
  readonly checkedAt: string;
}

/**
 * Registrar adapter socket. It can quote, purchase and reconcile registration only.
 * DNS records, certificates, routing and publication deliberately belong to later ports.
 */
export interface DomainRegistrarPort {
  quote(context: ProviderCallContext, request: DomainQuoteRequest): Promise<DomainRegistrationQuote>;
  purchase(context: DomainPurchaseCallContext, command: DomainPurchaseCommand): Promise<DomainRegistrationReceipt>;
  read(context: ProviderCallContext, externalReference: string): Promise<DomainRegistrationStatus>;
}
