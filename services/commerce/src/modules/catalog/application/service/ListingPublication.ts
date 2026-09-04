import { createHash } from 'node:crypto';
import type { DomainEvent } from '../../../../foundation/domain/DomainEvent';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { CatalogInventoryPort } from '../../../inventory/public';
import type { CatalogPricingPort } from '../../../pricing/public';
import type { CatalogQualificationPort } from '../../../qualification/public/CatalogQualificationPort';
import type { ListingCandidate, ListingRecord, ListingRepository } from '../port/ListingRepository';
import { Listing } from '../../domain/model/Listing';
import { listingPublishedEvent, listingUnpublishedEvent } from '../../domain/event/CatalogEvents';
import { ListingEligibility } from '../../domain/policy/ListingEligibility';
import { ApplicationError } from '../../../../foundation/domain/ApplicationError';
import { allParallel } from '../../../../foundation/performance/Parallel';
import { currentListingPrice, saleableListingStock } from '../model/ListingAvailability';

export interface PublicationCommand {
  readonly id: string;
  readonly expectedVersion: number;
}
export interface PublicationReceipt {
  readonly id: string;
  readonly state: 'ready' | 'succeeded' | 'failed';
  readonly status: 'published' | 'unpublished' | null;
  readonly version: number | null;
  readonly error: string | null;
  readonly gaps: readonly string[];
}
export interface PublicationResult {
  readonly previewHash: string;
  readonly items: readonly PublicationReceipt[];
  readonly records: readonly ListingRecord[];
  readonly events: readonly DomainEvent[];
}

interface PublicationEvaluation {
  readonly previewHash: string;
  readonly items: readonly PublicationReceipt[];
  readonly decisions: ReadonlyMap<string, ReturnType<ListingEligibility['decide']>>;
  readonly candidates: ReadonlyMap<string, ListingCandidate>;
}

export class ListingPublication {
  private readonly policy = new ListingEligibility();
  constructor(
    private readonly listings: ListingRepository,
    private readonly qualifications: CatalogQualificationPort,
    private readonly pricing: CatalogPricingPort,
    private readonly inventory: CatalogInventoryPort
  ) {}

  async preview(context: WriteTransactionContext, scope: string, commands: readonly PublicationCommand[], action: 'publish' | 'unpublish'): Promise<PublicationResult> {
    const evaluation = await this.evaluate(context, scope, commands, action);
    return Object.freeze({ previewHash: evaluation.previewHash, items: evaluation.items, records: Object.freeze([]), events: Object.freeze([]) });
  }

  async execute(context: WriteTransactionContext, scope: string, commands: readonly PublicationCommand[], action: 'publish' | 'unpublish', previewHash: string, actor: string, trace: string): Promise<PublicationResult> {
    const evaluation = await this.evaluate(context, scope, commands, action);
    if (evaluation.previewHash !== previewHash) throw new ApplicationError('VERSION_CONFLICT', { reason: 'BATCH_PREVIEW_CHANGED' });
    return this.apply(context, commands, action, evaluation, actor, trace);
  }

  async change(context: WriteTransactionContext, scope: string, commands: readonly PublicationCommand[], action: 'publish' | 'unpublish', actor: string, trace: string): Promise<PublicationResult> {
    return this.apply(context, commands, action, await this.evaluate(context, scope, commands, action), actor, trace);
  }

  private async apply(context: WriteTransactionContext, commands: readonly PublicationCommand[], action: 'publish' | 'unpublish', evaluation: PublicationEvaluation, actor: string, trace: string): Promise<PublicationResult> {
    const changed = [] as import('../../domain/model/Listing').ListingSnapshot[];
    const ready = new Set(evaluation.items.filter(({ state }) => state === 'ready').map(({ id }) => id));
    const now = new Date().toISOString();
    for (const command of commands) {
      if (!ready.has(command.id)) continue;
      const listing = Listing.restore(evaluation.candidates.get(command.id)!.listing);
      changed.push((action === 'publish' ? listing.publish(command.expectedVersion, evaluation.decisions.get(command.id)!, now) : listing.unpublish(command.expectedVersion, now)).snapshot());
    }
    const records = await this.listings.save(context, changed);
    const saved = new Map(records.map((item) => [item.id, item]));
    const receipts = new Map(evaluation.items.filter(({ state }) => state === 'failed').map((item) => [item.id, item]));
    const events: DomainEvent[] = [];
    for (const snapshot of changed) {
      const row = saved.get(snapshot.id);
      if (!row) {
        receipts.set(snapshot.id, failed(snapshot.id, 'VERSION_CONFLICT', [], snapshot.version - 1));
        continue;
      }
      receipts.set(snapshot.id, Object.freeze({ id: row.id, state: 'succeeded', status: action === 'publish' ? 'published' : 'unpublished', version: Number(row.version), error: null, gaps: Object.freeze([]) }));
      events.push(action === 'publish' ? listingPublishedEvent(snapshot, { actor, trace }) : listingUnpublishedEvent(snapshot, { actor, trace }));
    }
    return Object.freeze({ previewHash: evaluation.previewHash, items: Object.freeze(commands.map(({ id }) => receipts.get(id)!)), records: Object.freeze(records), events: Object.freeze(events) });
  }

  private async evaluate(context: WriteTransactionContext, scope: string, commands: readonly PublicationCommand[], action: 'publish' | 'unpublish'): Promise<PublicationEvaluation> {
    const candidates = await this.listings.candidates(
      context,
      commands.map(({ id }) => id),
      scope
    );
    const byId = new Map(candidates.map((item) => [item.listing.id, item]));
    const dependencies = action === 'publish' ? await this.dependencies(context, scope, candidates) : null;
    const decisions = new Map<string, ReturnType<ListingEligibility['decide']>>();
    const receipts: PublicationReceipt[] = [];
    const evidence: unknown[] = [];
    for (const command of commands) {
      const candidate = byId.get(command.id);
      if (!candidate) {
        const receipt = failed(command.id, 'RESOURCE_NOT_FOUND');
        receipts.push(receipt);
        evidence.push({ command, receipt, candidate: null, dependencies: null });
        continue;
      }
      const decision =
        action === 'publish'
          ? this.decision(candidate, dependencies!)
          : this.policy.decide({
              productState: 'active',
              skuState: 'active',
              poolReady: true,
              scopeReady: true,
              qualification: { eligible: true, version: 0 },
              price: { eligible: true, version: null },
              inventory: { eligible: true, version: null },
              channelReady: true,
            });
      decisions.set(command.id, decision);
      try {
        const listing = Listing.restore(candidate.listing);
        if (action === 'publish') listing.publish(command.expectedVersion, decision, '2000-01-01T00:00:00.000Z');
        else listing.unpublish(command.expectedVersion, '2000-01-01T00:00:00.000Z');
        const receipt = Object.freeze({ id: command.id, state: 'ready', status: action === 'publish' ? 'published' : 'unpublished', version: candidate.listing.version, error: null, gaps: Object.freeze([]) }) as PublicationReceipt;
        receipts.push(receipt);
        evidence.push({ command, receipt, candidate: candidate.listing, dependencies: decision.dependencies });
      } catch (cause) {
        const error = cause instanceof ApplicationError ? cause.code : 'LISTING_NOT_PURCHASABLE';
        const gaps = cause instanceof ApplicationError && Array.isArray(cause.details.gaps) ? cause.details.gaps.filter((item): item is string => typeof item === 'string') : [];
        const receipt = failed(command.id, error, gaps, candidate.listing.version);
        receipts.push(receipt);
        evidence.push({ command, receipt, candidate: candidate.listing, dependencies: decision.dependencies });
      }
    }
    const previewHash = createHash('sha256').update(JSON.stringify({ scope, action, evidence })).digest('hex');
    return Object.freeze({ previewHash, items: Object.freeze(receipts), decisions, candidates: byId });
  }

  private async dependencies(context: WriteTransactionContext, scope: string, candidates: readonly ListingCandidate[]) {
    const subjects = candidates.map((item) => ({ listing: item.listing.id, product: item.product, category: item.category, partner: item.partner, regions: item.regions }));
    const skus = [...new Set(candidates.map((item) => item.listing.sku))];
    const [qualifications, prices, stock] = await allParallel([() => this.qualifications.decisions(context, scope, subjects), () => this.pricing.prices(context, skus, [scope]), () => this.inventory.stock(context, skus, [scope])] as const, {
      concurrency: 3,
      expiresAt: context.deadline,
      signal: context.signal,
    });
    return Object.freeze({
      qualifications: new Map(qualifications.map((item) => [item.listing, item])),
      prices: new Map(prices.filter((item) => currentListingPrice(item)).map((item) => [String(item.sku), item])),
      stock: new Map(stock.filter((item) => (saleableListingStock(item) ?? 0) > 0).map((item) => [String(item.sku), item])),
    });
  }

  private decision(candidate: ListingCandidate, dependencies: Awaited<ReturnType<ListingPublication['dependencies']>>) {
    const qualification = dependencies.qualifications.get(candidate.listing.id);
    const price = dependencies.prices.get(candidate.listing.sku);
    const stock = dependencies.stock.get(candidate.listing.sku);
    return this.policy.decide({
      productState: candidate.productState,
      skuState: candidate.skuState,
      poolReady: candidate.poolReady,
      scopeReady: candidate.scopeReady,
      qualification: { eligible: qualification?.eligible ?? true, version: qualification?.policyVersion ?? 0 },
      price: { eligible: price !== undefined, version: price === undefined ? null : String(price.bookVersion ?? price.version ?? '') },
      inventory: { eligible: stock !== undefined, version: stock === undefined ? null : Number(stock.version ?? 0) },
      channelReady: candidate.channelReady,
    });
  }
}

function failed(id: string, error: string, gaps: readonly string[] = [], version: number | null = null): PublicationReceipt {
  return Object.freeze({ id, state: 'failed', status: null, version, error, gaps: Object.freeze([...gaps]) });
}
