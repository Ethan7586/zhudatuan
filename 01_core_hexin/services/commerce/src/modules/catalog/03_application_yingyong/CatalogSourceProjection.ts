import { createHash } from 'node:crypto';
import type { JsonObject } from '@shop/contract';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { inventoryPort } from '../../inventory';
import { pricingPort } from '../../pricing';

export interface CatalogSourceProjectionInput {
  readonly provider: string;
  readonly scope: string;
  readonly region: string;
  readonly external: string;
  readonly version: string;
  readonly payload: JsonObject;
}

export interface CatalogSourceProjectionResult {
  readonly product: string;
  readonly sku: string;
  readonly listing: string;
}

export class CatalogSourceProjection {
  async project(database: OperationDatabase, input: CatalogSourceProjectionInput): Promise<CatalogSourceProjectionResult | null> {
    if (input.provider !== 'cake') return null;
    const source = cakeSource(input.payload);
    const category = await database.query<{ id: string }>(
      "select id from catalog.category where code='food' and status='active' limit 1",
    );
    const categoryId = category.rows[0]?.id;
    if (!categoryId) throw new Error('CAKE_CATALOG_CATEGORY_MISSING');

    const product = `product:source:${digest(`${input.scope}:cake:${source.productId}`)}`;
    const sku = `sku:source:${digest(`${input.scope}:cake:${source.specId}`)}`;
    const listing = `listing:source:${digest(`${input.scope}:${sku}`)}`;
    const title = source.specName === source.productName ? source.productName : `${source.productName} · ${source.specName}`;
    const media = source.imagePaths.map((url) => Object.freeze({ kind: 'image', url }));
    const attributes = {
      description: source.description,
      subtitle: [source.brandName, source.specName].filter(Boolean).join(' · ') || '蛋糕烘焙',
      coverUrl: source.imagePaths[0],
      media,
      provider: 'cake',
      externalProductId: source.productId,
      cityIds: source.cityIds,
      labels: source.labels,
      storage: source.storage,
      expiryDays: source.expiryDays,
      supportsGreeting: source.supportsGreeting,
      charges: source.charges,
    };
    const specifications = {
      provider: 'cake',
      externalSpecId: source.specId,
      name: source.specName,
      tastes: source.tastes,
      unlimited: source.unlimited,
    };

    await database.query(`insert into catalog.product(id,owner_partner_id,brand_id,category_id,title,product_type,attributes,status,version,created_at,updated_at)
      values($1,null,null,$2,$3,'physical',$4::jsonb,'active',0,clock_timestamp(),clock_timestamp())
      on conflict(id) do update set category_id=excluded.category_id,title=excluded.title,attributes=excluded.attributes,
        status='active',version=catalog.product.version+1,updated_at=clock_timestamp()`,
    [product, categoryId, source.productName, JSON.stringify(attributes)]);
    await database.query(`insert into catalog.sku(id,product_id,code,specifications,status,version)
      values($1,$2,$3,$4::jsonb,'active',0)
      on conflict(id) do update set product_id=excluded.product_id,code=excluded.code,specifications=excluded.specifications,
        status='active',version=catalog.sku.version+1`,
    [sku, product, `CAKE-${digest(`${input.scope}:${source.specId}`).slice(0, 16)}`, JSON.stringify(specifications)]);
    await database.query(`insert into catalog.listing(id,scope_id,pool_id,sku_id,title,status,effective_at,expires_at,version,created_at,updated_at)
      values($1,$2,null,$3,$4,'draft',null,null,0,clock_timestamp(),clock_timestamp())
      on conflict(scope_id,sku_id) do update set title=excluded.title,
        status=case when catalog.listing.status='retired' then 'draft' else catalog.listing.status end,
        version=catalog.listing.version+1,updated_at=clock_timestamp()`,
    [listing, input.scope, sku, title]);
    await pricingPort.upsertCatalogPackageOffer(database, {
      scope: input.scope,
      sku,
      amountMinor: source.amountMinor,
      compareMinor: source.compareMinor,
      sourceVersion: input.version,
    });
    await inventoryPort.observe(database, {
      id: `stock:${digest(`${input.scope}:${sku}:${input.region}`)}`,
      scope: input.scope,
      sku,
      location: input.region,
      onhand: source.onhand,
      safety: 0,
      provider: input.provider,
      version: input.version,
    });
    await database.query(`update catalog.sourcelisting set sku_id=$4,status='mapped',observed_at=clock_timestamp()
      where provider=$1 and scope_id=$2 and external_id=$3`, [input.provider, input.scope, input.external, sku]);
    const mediaJob = `job:catalogmedia:${digest(`${product}:${source.imagePaths.join('|')}`)}`;
    await database.query(`insert into runtime.job(
      id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
      values($1,'catalogmediareplication','catalog',$2,
        jsonb_build_object('productId',$3::text,'sourceUrls',$4::jsonb,'purpose','cover','position',0),
        'queued',100,clock_timestamp(),clock_timestamp(),clock_timestamp())
      on conflict(id) do nothing`, [mediaJob, input.scope, product, JSON.stringify(source.imagePaths)]);
    return Object.freeze({ product, sku, listing });
  }
}

interface CakeSource {
  readonly productId: string;
  readonly specId: string;
  readonly productName: string;
  readonly specName: string;
  readonly description: string;
  readonly brandName: string | null;
  readonly imagePaths: readonly string[];
  readonly cityIds: readonly string[];
  readonly labels: readonly string[];
  readonly tastes: readonly string[];
  readonly storage: string | null;
  readonly expiryDays: number | null;
  readonly supportsGreeting: boolean;
  readonly charges: readonly JsonObject[];
  readonly amountMinor: number;
  readonly compareMinor: number | null;
  readonly onhand: number;
  readonly unlimited: boolean;
}

function cakeSource(value: JsonObject): CakeSource {
  if (value.schema !== 'cakeuncle.physical-sku.v1') throw new Error('CAKE_CATALOG_SOURCE_SCHEMA_INVALID');
  const imagePaths = stringArray(value.imagePaths, 'CAKE_CATALOG_MEDIA_REQUIRED');
  if (imagePaths.length === 0) throw new Error('CAKE_CATALOG_MEDIA_REQUIRED');
  return Object.freeze({
    productId: text(value.productId, 'CAKE_CATALOG_PRODUCT_ID_INVALID'),
    specId: text(value.specId, 'CAKE_CATALOG_SPEC_ID_INVALID'),
    productName: text(value.productName, 'CAKE_CATALOG_PRODUCT_NAME_INVALID'),
    specName: text(value.specName, 'CAKE_CATALOG_SPEC_NAME_INVALID'),
    description: text(value.description, 'CAKE_CATALOG_DESCRIPTION_INVALID'),
    brandName: optionalText(value.brandName),
    imagePaths,
    cityIds: stringArray(value.cityIds, 'CAKE_CATALOG_CITY_IDS_INVALID'),
    labels: stringArray(value.labels, 'CAKE_CATALOG_LABELS_INVALID'),
    tastes: stringArray(value.tastes, 'CAKE_CATALOG_TASTES_INVALID'),
    storage: optionalText(value.storage),
    expiryDays: optionalInteger(value.expiryDays, 'CAKE_CATALOG_EXPIRY_INVALID'),
    supportsGreeting: value.supportsGreeting === true,
    charges: objectArray(value.charges, 'CAKE_CATALOG_CHARGES_INVALID'),
    amountMinor: integer(value.amountMinor, 'CAKE_CATALOG_PRICE_INVALID'),
    compareMinor: optionalInteger(value.compareMinor, 'CAKE_CATALOG_COMPARE_PRICE_INVALID'),
    onhand: integer(value.onhand, 'CAKE_CATALOG_STOCK_INVALID'),
    unlimited: value.unlimited === true,
  });
}

function text(value: unknown, code: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(code);
  return value.trim();
}

function optionalText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function integer(value: unknown, code: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error(code);
  return Number(value);
}

function optionalInteger(value: unknown, code: string): number | null {
  return value === undefined || value === null ? null : integer(value, code);
}

function stringArray(value: unknown, code: string): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.trim().length === 0)) throw new Error(code);
  return Object.freeze(value.map((item) => String(item).trim()));
}

function objectArray(value: unknown, code: string): readonly JsonObject[] {
  if (!Array.isArray(value) || value.some((item) => item === null || typeof item !== 'object' || Array.isArray(item))) throw new Error(code);
  return Object.freeze(value as JsonObject[]);
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export const catalogSourceProjection = new CatalogSourceProjection();
