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

export class PutCartItem {
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
    const change = this.policy.put(request);
    const access = requireAccess(request);
    const owner = await this.members.profile(database, access.membership.id);
    const application = await this.experience.active(database, owner.organization);
    if (!application) throw new Error('ACTIVE_MALL_APPLICATION_MISSING');
    const cart = await this.carts.lockOrCreate(database, owner.member, owner.organization, application, expectedVersion);
    const versions = await this.carts.lineVersions(database, cart, [change.listing]);
    const actual = versions.get(change.listing);
    if (actual === undefined ? change.lineVersion !== null : actual !== change.lineVersion) return cartConflict();
    const mutation = await this.mutation(database, owner.organization, change.listing, change.quantity, change.lineVersion);
    await this.carts.mutate(database, cart, [mutation]);
    return { status: 200, body: await this.carts.snapshot(database, cart) };
  }

  private async mutation(database: OperationDatabase, mall: string, listing: string, quantity: number, version: number | null): Promise<CartLineMutation> {
    if (quantity === 0) return Object.freeze({ listing, quantity, version, sku: '', title: '', listingVersion: '', unitMinor: 0, currency: '', priceVersion: '' });
    const item = await this.catalog.purchasable(database, listing, mall);
    if (!item) return listingUnavailable();
    const price = await this.pricing.current(database, mall, item.sku);
    if (!price) return listingUnavailable();
    return Object.freeze({ listing, quantity, version, sku: item.sku, title: item.title, listingVersion: String(item.version), unitMinor: price.amountMinor, currency: price.currency, priceVersion: price.version });
  }
}
