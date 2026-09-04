import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { ProductKind, ProductSnapshot, ProductState } from '../../domain/model/Product';

export interface ProductDetailBase {
  readonly id: string;
  readonly title: string;
  readonly product_type: ProductKind;
  readonly status: ProductState;
  readonly version: string | number;
  readonly category_id: string;
  readonly brand_id: string | null;
  readonly owner_partner_id: string | null;
  readonly cover_url: string | null;
  readonly subtitle: string | null;
  readonly description: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly regionIds: readonly string[];
  readonly skus: readonly Readonly<{ id: string; code: string; status: string; specifications: readonly Readonly<{ name: string; value: string }>[]; version: string | number }>[];
  readonly listings: readonly Readonly<{ id: string; scope: string; pool: string | null; sku: string; title: string; status: string; effectiveAt: string | null; expiresAt: string | null; createdAt: string; updatedAt: string; version: string | number }>[];
  readonly media: readonly Readonly<{ id: string; kind: 'image' | 'video' | 'document'; url: string; alt: string | null; sort: number }>[];
  readonly channels: readonly Readonly<{ provider: string; externalId: string; status: 'pending' | 'mapped' | 'rejected' | 'retired'; sourceVersion: string; observedAt: string }>[];
  readonly pools: readonly Readonly<{ id: string; name: string; kind: 'global' | 'channel' | 'private' | 'markup'; status: 'draft' | 'active' | 'disabled'; listingCount: number }>[];
  readonly timeline: readonly Readonly<{ id: string; kind: 'productcreated' | 'productupdated' | 'listingcreated' | 'listingupdated' | 'sourceobserved'; title: string; occurredAt: string; reference: string | null }>[];
  readonly visibleScopes: readonly string[];
}

export interface ProductRepository {
  detail(context: ReadTransactionContext, product: string, scope: string, store: boolean): Promise<ProductDetailBase>;
  create(
    context: WriteTransactionContext,
    input: Readonly<{ scope: string; owner: string | null; brand: string | null; category: string; title: string; kind: ProductKind; attributes: Readonly<Record<string, unknown>> }>
  ): Promise<Readonly<Record<string, unknown>>>;
  update(
    context: WriteTransactionContext,
    input: Readonly<{ id: string; scope: string; title: string | null; category: string | null; attributes: Readonly<Record<string, unknown>> | null; status: ProductState | null; expectedVersion: number }>
  ): Promise<Readonly<Record<string, unknown>>>;
  archive(context: WriteTransactionContext, id: string, scope: string, expectedVersion: number): Promise<Readonly<Record<string, unknown>>>;
}
