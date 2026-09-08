import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { domainToASCII } from 'node:url';
import type {
  DomainPurchaseApproval,
  DomainPurchaseCommand,
  DomainPurchaseOwner,
  DomainQuoteRequest,
  PurchasableDomainQuote,
} from '@shop/contract';

export interface DomainPurchaseIntent {
  readonly purchaseId: string;
  readonly owner: DomainPurchaseOwner;
  readonly requestedDomain: string;
  readonly registrationYears: number;
  readonly maxAmountMinor: number;
  readonly currency: string;
  readonly registrantContactRef: string;
}

export class DomainPurchasePolicy {
  private readonly reservedZones: readonly string[];

  constructor(reservedZones: readonly string[]) {
    if (reservedZones.length === 0) throw new Error('DOMAIN_PURCHASE_RESERVED_ZONES_MISSING');
    this.reservedZones = Object.freeze([...new Set(reservedZones.map((zone) => canonicalDomain(zone)))]);
  }

  quoteRequest(intent: DomainPurchaseIntent): DomainQuoteRequest {
    const owner = purchaseOwner(intent.owner);
    const domainAscii = canonicalDomain(intent.requestedDomain);
    if (this.reservedZones.some((zone) => domainAscii === zone || domainAscii.endsWith(`.${zone}`))) {
      throw new Error('DOMAIN_PURCHASE_PLATFORM_ZONE_FORBIDDEN');
    }
    text(intent.purchaseId, 'DOMAIN_PURCHASE_ID_INVALID');
    if (!Number.isInteger(intent.registrationYears) || intent.registrationYears < 1 || intent.registrationYears > 10) {
      throw new Error('DOMAIN_PURCHASE_YEARS_INVALID');
    }
    amount(intent.maxAmountMinor, 'DOMAIN_PURCHASE_MAX_AMOUNT_INVALID');
    currency(intent.currency, 'DOMAIN_PURCHASE_CURRENCY_INVALID');
    contactReference(intent.registrantContactRef);
    return Object.freeze({
      purchaseId: intent.purchaseId,
      owner,
      domainAscii,
      registrationYears: intent.registrationYears,
    });
  }

  quoteFingerprint(intent: DomainPurchaseIntent, quote: PurchasableDomainQuote): string {
    const request = this.quoteRequest(intent);
    const checked = purchasableQuote(request, quote);
    return createHash('sha256').update(JSON.stringify({ purchaseId: request.purchaseId, owner: request.owner, quote: checked })).digest('hex');
  }

  authorize(
    intent: DomainPurchaseIntent,
    quote: PurchasableDomainQuote,
    approval: DomainPurchaseApproval,
    now: Date,
  ): DomainPurchaseCommand {
    const request = this.quoteRequest(intent);
    const checkedQuote = purchasableQuote(request, quote);
    if (checkedQuote.currency !== intent.currency) throw new Error('DOMAIN_PURCHASE_QUOTE_CURRENCY_MISMATCH');
    const nowTime = validTime(now.toISOString(), 'DOMAIN_PURCHASE_CLOCK_INVALID');
    const checkedAt = validTime(checkedQuote.checkedAt, 'DOMAIN_PURCHASE_QUOTE_TIME_INVALID');
    const expiresAt = validTime(checkedQuote.expiresAt, 'DOMAIN_PURCHASE_QUOTE_EXPIRY_INVALID');
    if (checkedAt > nowTime || expiresAt <= checkedAt || expiresAt <= nowTime) throw new Error('DOMAIN_PURCHASE_QUOTE_EXPIRED');
    if (checkedQuote.totalMinor > intent.maxAmountMinor) throw new Error('DOMAIN_PURCHASE_PRICE_LIMIT_EXCEEDED');

    text(approval.approvalId, 'DOMAIN_PURCHASE_APPROVAL_ID_INVALID');
    text(approval.membershipId, 'DOMAIN_PURCHASE_APPROVER_INVALID');
    if (!/^hold:[A-Za-z0-9._:-]{3,240}$/.test(approval.fundingHoldRef)) throw new Error('DOMAIN_PURCHASE_FUNDING_HOLD_INVALID');
    if (approval.assuranceLevel !== 2 && approval.assuranceLevel !== 3) throw new Error('DOMAIN_PURCHASE_ASSURANCE_INVALID');
    const approvedAt = validTime(approval.approvedAt, 'DOMAIN_PURCHASE_APPROVAL_TIME_INVALID');
    if (approval.purchaseId !== request.purchaseId || approval.scopeId !== request.owner.mallId
      || approval.amountMinor !== checkedQuote.totalMinor || approval.currency !== checkedQuote.currency
      || approval.quoteFingerprint !== this.quoteFingerprint(intent, checkedQuote)
      || approvedAt < checkedAt || approvedAt > nowTime || approvedAt >= expiresAt) {
      throw new Error('DOMAIN_PURCHASE_APPROVAL_MISMATCH');
    }

    return Object.freeze({
      purchaseId: request.purchaseId,
      owner: request.owner,
      quote: Object.freeze({ ...checkedQuote }),
      registrantContactRef: intent.registrantContactRef,
      approval: Object.freeze({ ...approval }),
    });
  }
}

function purchaseOwner(owner: DomainPurchaseOwner): DomainPurchaseOwner {
  text(owner.organizationId, 'DOMAIN_PURCHASE_ORGANIZATION_INVALID');
  text(owner.mallId, 'DOMAIN_PURCHASE_MALL_INVALID');
  if (!/^L[0-5]$/.test(owner.resolvedLevel)) throw new Error('DOMAIN_PURCHASE_LEVEL_NOT_ELIGIBLE');
  return Object.freeze({ ...owner });
}

function purchasableQuote(request: DomainQuoteRequest, quote: PurchasableDomainQuote): PurchasableDomainQuote {
  text(quote.providerId, 'DOMAIN_PURCHASE_PROVIDER_INVALID');
  text(quote.quoteId, 'DOMAIN_PURCHASE_QUOTE_ID_INVALID');
  if (quote.availability !== 'available' && quote.availability !== 'premium') throw new Error('DOMAIN_PURCHASE_NOT_AVAILABLE');
  if (quote.domainAscii !== request.domainAscii || quote.registrationYears !== request.registrationYears) {
    throw new Error('DOMAIN_PURCHASE_QUOTE_MISMATCH');
  }
  amount(quote.totalMinor, 'DOMAIN_PURCHASE_QUOTE_AMOUNT_INVALID');
  currency(quote.currency, 'DOMAIN_PURCHASE_QUOTE_CURRENCY_INVALID');
  return quote;
}

function canonicalDomain(value: string): string {
  const candidate = value.trim().toLowerCase().replace(/\.$/, '');
  if (!candidate || /[\s/:@?#*]/.test(candidate)) throw new Error('DOMAIN_PURCHASE_NAME_INVALID');
  const ascii = domainToASCII(candidate);
  const labels = ascii.split('.');
  if (!ascii || ascii.length > 253 || labels.length < 2 || isIP(ascii)
    || labels.some((label) => label.length < 1 || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) {
    throw new Error('DOMAIN_PURCHASE_NAME_INVALID');
  }
  return ascii;
}

function text(value: string, code: string): string {
  if (typeof value !== 'string' || value.trim().length < 3 || value.trim().length > 255 || /\s/.test(value)) throw new Error(code);
  return value.trim();
}

function amount(value: number, code: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(code);
  return value;
}

function currency(value: string, code: string): string {
  if (!/^[A-Z]{3}$/.test(value)) throw new Error(code);
  return value;
}

function contactReference(value: string): void {
  if (!/^(?:secret|vault|kms)(?::\/\/|\/)[A-Za-z0-9._:/-]{3,240}$/.test(value)) {
    throw new Error('DOMAIN_PURCHASE_REGISTRANT_REFERENCE_INVALID');
  }
}

function validTime(value: string, code: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(code);
  return parsed;
}
