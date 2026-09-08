import { randomUUID } from 'node:crypto';
import { domainEvent, type DomainEvent } from '@shop/kernel';
import type { ListingSnapshot } from '../model/Listing';
import type { ProductSnapshot } from '../model/Product';

interface EventContext {
  readonly actor: string;
  readonly trace: string;
}

export function listingPublishedEvent(listing: ListingSnapshot, context: EventContext): DomainEvent {
  return event('catalog.listing.published', 'listing', listing.id, listing.scope, listing.version, context, { listing: listing.id, sku: listing.sku, scope: listing.scope, version: listing.version });
}

export function listingUnpublishedEvent(listing: ListingSnapshot, context: EventContext): DomainEvent {
  return event('catalog.listing.unpublished', 'listing', listing.id, listing.scope, listing.version, context, { listing: listing.id, reason: 'manual', decision: context.trace });
}

export function productEvent(type: 'catalog.product.created' | 'catalog.product.updated' | 'catalog.product.archived', product: ProductSnapshot, context: EventContext): DomainEvent {
  return event(type, 'product', product.id, product.scope, product.version, context, { product: product.id, scope: product.scope, status: product.state, version: product.version });
}

export function productRecordEvent(type: 'catalog.product.created' | 'catalog.product.updated' | 'catalog.product.archived', record: Readonly<Record<string, unknown>>, context: EventContext): DomainEvent {
  return productEvent(
    type,
    {
      id: String(record.id),
      scope: String(record.scope_id),
      owner: typeof record.owner_partner_id === 'string' ? record.owner_partner_id : null,
      brand: typeof record.brand_id === 'string' ? record.brand_id : null,
      category: String(record.category_id),
      title: String(record.title),
      kind: record.product_type as ProductSnapshot['kind'],
      attributes: record.attributes as Readonly<Record<string, unknown>>,
      state: record.status as ProductSnapshot['state'],
      version: Number(record.version),
    },
    context
  );
}

function event(type: string, aggregateType: string, aggregate: string, scope: string, version: number, context: EventContext, payload: Readonly<Record<string, unknown>>): DomainEvent {
  return domainEvent({
    event: `event:${randomUUID()}`,
    type,
    version: 1,
    aggregate: { type: aggregateType, id: aggregate, version },
    tenant: scope,
    actor: context.actor,
    occurred: new Date().toISOString(),
    trace: context.trace,
    correlation: context.trace,
    causation: context.trace,
    payloadVersion: 1,
    payload,
  });
}
