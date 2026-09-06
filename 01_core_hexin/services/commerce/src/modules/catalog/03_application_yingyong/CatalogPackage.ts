import { createHash } from 'node:crypto';
import type { ObjectStore } from '../../../foundation/infrastructure/ObjectStore';

export const CATALOG_PACKAGE_SCHEMA = 'catalog-package/v1';
const MAXIMUM_PACKAGE_BYTES = 32 * 1024 * 1024;
const MAXIMUM_PACKAGE_ITEMS = 100_000;

export interface CatalogPackageDocument {
  readonly packageId: string;
  readonly summary: Readonly<Record<string, unknown>>;
  readonly rows: readonly Readonly<Record<string, string>>[];
}

export async function readCatalogPackage(
  objects: ObjectStore,
  reference: string,
  sha256: string,
): Promise<CatalogPackageDocument> {
  const metadata = await objects.inspect(reference);
  if (metadata.scan !== 'clean' || metadata.contentType !== 'application/json' || metadata.sha256 !== sha256
    || metadata.size > MAXIMUM_PACKAGE_BYTES) throw new Error('CATALOG_PACKAGE_OBJECT_INVALID');
  const bytes = await objects.read(reference, MAXIMUM_PACKAGE_BYTES);
  if (createHash('sha256').update(bytes).digest('hex') !== sha256) throw new Error('CATALOG_PACKAGE_HASH_MISMATCH');
  return parseCatalogPackage(bytes);
}

export function parseCatalogPackage(bytes: Uint8Array): CatalogPackageDocument {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new Error('CATALOG_PACKAGE_JSON_INVALID');
  }
  const packageValue = record(value, 'CATALOG_PACKAGE_INVALID');
  if (packageValue.schema !== CATALOG_PACKAGE_SCHEMA) throw new Error('CATALOG_PACKAGE_VERSION_UNSUPPORTED');
  const packageId = text(packageValue.packageId, 'CATALOG_PACKAGE_ID_INVALID', 128);
  const compiledAt = text(packageValue.compiledAt, 'CATALOG_PACKAGE_COMPILED_AT_INVALID', 64);
  if (Number.isNaN(Date.parse(compiledAt))) throw new Error('CATALOG_PACKAGE_COMPILED_AT_INVALID');
  const source = record(packageValue.source, 'CATALOG_PACKAGE_SOURCE_INVALID');
  const sourceName = text(source.name, 'CATALOG_PACKAGE_SOURCE_NAME_INVALID', 200);
  const sourceFile = text(source.file, 'CATALOG_PACKAGE_SOURCE_FILE_INVALID', 500);
  const validation = record(packageValue.validation, 'CATALOG_PACKAGE_VALIDATION_INVALID');
  if (!['passed', 'partial'].includes(String(validation.status))) throw new Error('CATALOG_PACKAGE_VALIDATION_INVALID');
  const compilerErrors = Array.isArray(validation.errors) ? validation.errors : null;
  if (compilerErrors === null) throw new Error('CATALOG_PACKAGE_VALIDATION_INVALID');
  if (!Array.isArray(packageValue.items) || packageValue.items.length === 0 || packageValue.items.length > MAXIMUM_PACKAGE_ITEMS) {
    throw new Error('CATALOG_PACKAGE_ITEMS_INVALID');
  }
  const rows = packageValue.items.map((item, index) => packageRow(item, packageId, source, index + 1));
  return Object.freeze({
    packageId,
    summary: Object.freeze({
      format: CATALOG_PACKAGE_SCHEMA,
      packageId,
      compiledAt,
      source: Object.freeze({ name: sourceName, file: sourceFile }),
      compilerValidation: Object.freeze({ status: validation.status, errorCount: compilerErrors.length }),
      rows: rows.length,
    }),
    rows: Object.freeze(rows),
  });
}

function packageRow(
  value: unknown,
  packageId: string,
  packageSource: Readonly<Record<string, unknown>>,
  index: number,
): Readonly<Record<string, string>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return Object.freeze({ packageId, sourceRow: String(index), packageError: 'CATALOG_PACKAGE_ITEM_INVALID' });
  }
  const item = value as Readonly<Record<string, unknown>>;
  const source = optionalRecord(item.source);
  const product = optionalRecord(item.product);
  const sku = optionalRecord(item.sku);
  const offer = optionalRecord(item.offer);
  const inventory = optionalRecord(item.inventory);
  const publication = optionalRecord(item.publication);
  const validation = optionalRecord(item.validation);
  const media = Array.isArray(product.media) ? product.media : [];
  return Object.freeze({
    packageId,
    packageSource: JSON.stringify(packageSource),
    sourceTrace: JSON.stringify(source),
    sourceRow: scalar(source.row) || String(index),
    title: scalar(product.title),
    description: scalar(product.description),
    category: scalar(product.category),
    type: scalar(product.type),
    attributes: jsonCell(product.attributes),
    media: JSON.stringify(media),
    sku: scalar(sku.code),
    specifications: jsonCell(sku.specifications),
    currency: scalar(offer.currency),
    priceMinor: scalar(offer.amountMinor),
    compareMinor: scalar(offer.compareMinor),
    stock: scalar(inventory.available),
    status: scalar(publication.state),
    validation: JSON.stringify(validation),
  });
}

function record(value: unknown, code: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Readonly<Record<string, unknown>>;
}

function optionalRecord(value: unknown): Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>> : {};
}

function text(value: unknown, code: string, maximum: number): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > maximum) throw new Error(code);
  return value.trim();
}

function scalar(value: unknown): string {
  return typeof value === 'string' ? value.trim()
    : typeof value === 'number' || typeof value === 'boolean' ? String(value) : '';
}

function jsonCell(value: unknown): string {
  return value === undefined ? '{}' : JSON.stringify(value);
}
