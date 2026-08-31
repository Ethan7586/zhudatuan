import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationExecution';
import { requireAccess, type OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { MemberAccessPort } from '../../../access/public';
import type { CartCatalogPort } from '../../../catalog/public';
import type { CartExperiencePort } from '../../../experience/public';
import type { CartPricingPort } from '../../../pricing/public';
import type { CartLineMutation } from '../../domain/model/CartLine';
import { cartConflict, listingUnavailable } from '../../domain/error/CartError';
import { CartPolicy } from '../../domain/policy/CartPolicy';
import type { CartRepository } from '../port/CartRepository';

export class BatchCartItems {
  private readonly policy = new CartPolicy();

  constructor(
    private readonly members: MemberAccessPort,
    private readonly experience: CartExperiencePort,
    private readonly catalog: CartCatalogPort,
    private readonly pricing: CartPricingPort,
    private readonly carts: CartRepository
  ) {}

  async execute(request: OperationRequest, database: OperationDatabase): Promise<OperationResult> {
    const expectedVersion = request.input.expectedVersion;
    if (expectedVersion === undefined) return cartConflict();
    const changes = this.policy.batch(request);
    const access = requireAccess(request);
    const owner = await this.members.profile(database, access.membership.id);
    const application = await this.experience.active(database, owner.organization);
    if (!application) throw new Error('ACTIVE_MALL_APPLICATION_MISSING');
    const cart = await this.carts.lockExisting(database, owner.member, owner.organization, application, expectedVersion);
    const versions = await this.carts.lineVersions(
      database,
      cart,
      changes.map(({ listing }) => listing)
    );
    for (const change of changes) {
      const actual = versions.get(change.listing);
      if (actual === undefined ? change.lineVersion !== null : actual !== change.lineVersion) return cartConflict();
    }
    const positive = changes.filter(({ quantity }) => quantity > 0);
    const listings = await this.catalog.purchasableMany(
      database,
      positive.map(({ listing }) => listing),
      owner.organization
    );
    if (positive.some(({ listing }) => !listings.has(listing))) return listingUnavailable();
    const prices = await this.pricing.currentMany(
      database,
      owner.organization,
      positive.map(({ listing }) => listings.get(listing)!.sku)
    );
    if (positive.some(({ listing }) => !prices.has(listings.get(listing)!.sku))) return listingUnavailable();
    const mutations: readonly CartLineMutation[] = changes.map(({ listing, quantity, lineVersion }) => {
      const item = listings.get(listing);
      const price = item ? prices.get(item.sku) : undefined;
      return Object.freeze({
        listing,
        quantity,
        version: lineVersion,
        sku: item?.sku ?? '',
        title: item?.title ?? '',
        listingVersion: item ? String(item.version) : '',
        unitMinor: price?.amountMinor ?? 0,
        currency: price?.currency ?? '',
        priceVersion: price?.version ?? '',
      });
    });
    await this.carts.mutate(database, cart, mutations);
    return { status: 200, body: await this.carts.snapshot(database, cart) };
  }
}
