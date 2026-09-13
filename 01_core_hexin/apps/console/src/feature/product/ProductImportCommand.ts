import { createFetchCatalogImportsCreate } from '@shop/sdk/catalog';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleCommand } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { CatalogImportCreateSchema } from './ProductSchema';

const catalogImportsCreate = createFetchCatalogImportsCreate(appConfig.apiBaseUrl);
export const CATALOG_PACKAGE_SCHEMA = 'catalog-package/v1';

export interface CatalogPackagePreview {
  readonly packageId: string;
  readonly source: string;
  readonly items: number;
  readonly valid: number;
  readonly invalid: number;
}

export interface ManualProductDraft {
  readonly title: string;
  readonly description: string;
  readonly category: string;
  readonly productType: 'physical' | 'virtual' | 'service' | 'voucher';
  readonly skuCode: string;
  readonly mediaUrl: string;
  readonly amountMinor: number;
  readonly compareMinor?: number;
  readonly available: number;
  readonly specifications: Readonly<Record<string, string>>;
  readonly attributes?: Readonly<Record<string, string | number>>;
}

export function canCreateCatalogImport(context: ConsoleContext): boolean {
  return context.scope.kind === 'mall'
    && context.session.csrf !== undefined
    && context.session.permissions.includes('catalog.import.manage')
    && context.session.permissions.includes('catalog.import.read')
    && context.session.capabilities.includes('catalog.imports.create')
    && context.session.capabilities.includes('catalog.imports.read');
}

export async function previewCatalogPackage(file: File): Promise<Readonly<{ content: string; preview: CatalogPackagePreview }>> {
  const content = await file.text();
  let parsed: unknown;
  try { parsed = JSON.parse(content); } catch { throw new Error('标准货盘包不是有效 JSON'); }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('标准货盘包顶层必须是对象');
  const value = parsed as Readonly<Record<string, unknown>>;
  if (value.schema !== CATALOG_PACKAGE_SCHEMA) throw new Error(`仅支持 ${CATALOG_PACKAGE_SCHEMA}`);
  if (typeof value.packageId !== 'string' || value.packageId.trim() === '') throw new Error('标准货盘包缺少 packageId');
  const source = value.source !== null && typeof value.source === 'object' && !Array.isArray(value.source)
    ? value.source as Readonly<Record<string, unknown>> : {};
  if (typeof source.name !== 'string' || source.name.trim() === '') throw new Error('标准货盘包缺少 source.name');
  if (!Array.isArray(value.items) || value.items.length === 0) throw new Error('标准货盘包没有商品行');
  const states = value.items.map((item) => item !== null && typeof item === 'object' && !Array.isArray(item)
    ? (item as Readonly<Record<string, unknown>>).validation : null);
  const valid = states.filter((validation) => validation !== null && typeof validation === 'object'
    && !Array.isArray(validation) && (validation as Readonly<Record<string, unknown>>).status === 'valid').length;
  return Object.freeze({
    content,
    preview: Object.freeze({ packageId: value.packageId.trim(), source: source.name.trim(), items: value.items.length,
      valid, invalid: value.items.length - valid }),
  });
}

export async function createCatalogImport(
  context: ConsoleContext,
  filename: string,
  content: string,
  signal?: AbortSignal,
) {
  if (!canCreateCatalogImport(context)) throw new Error('CATALOG_IMPORT_NOT_AVAILABLE');
  const csrfToken = context.session.csrf;
  if (csrfToken === undefined) throw new Error('CATALOG_IMPORT_CSRF_MISSING');
  const sha256 = await digest(content);
  const value = await catalogImportsCreate(
    { body: { schema: CATALOG_PACKAGE_SCHEMA, filename, content, sha256 } },
    consoleCommand(context.scope, {
      accessVersion: context.session.accessVersion,
      csrfToken,
      idempotencyKey: `${CATALOG_PACKAGE_SCHEMA}:${sha256}`,
      ...(signal === undefined ? {} : { signal }),
    }),
  );
  return CatalogImportCreateSchema.parse(value);
}

export async function confirmCatalogImport(context: ConsoleContext, importId: string, signal?: AbortSignal) {
  if (!canCreateCatalogImport(context)) throw new Error('CATALOG_IMPORT_NOT_AVAILABLE');
  const csrfToken = context.session.csrf;
  if (csrfToken === undefined) throw new Error('CATALOG_IMPORT_CSRF_MISSING');
  const value = await catalogImportsCreate(
    { body: { confirmImportId: importId } },
    consoleCommand(context.scope, {
      accessVersion: context.session.accessVersion,
      csrfToken,
      idempotencyKey: `${CATALOG_PACKAGE_SCHEMA}:confirm:${importId}`,
      ...(signal === undefined ? {} : { signal }),
    }),
  );
  return CatalogImportCreateSchema.parse(value);
}

export function manualCatalogPackage(draft: ManualProductDraft): string {
  const token = crypto.randomUUID();
  return `${JSON.stringify({
    schema: CATALOG_PACKAGE_SCHEMA,
    packageId: `console-manual-${token}`,
    compiledAt: new Date().toISOString(),
    source: { name: 'Console 手工录入', file: 'console-manual', dataSource: 'manual' },
    validation: { status: 'passed', errors: [] },
    items: [{
      source: { row: 1, productRef: `manual-product-${token}`, skuRef: `manual-sku-${token}` },
      product: {
        title: draft.title, description: draft.description, category: draft.category, type: draft.productType,
        attributes: { entryMode: 'manual', ...draft.attributes }, media: [{ kind: 'image', url: draft.mediaUrl }],
      },
      sku: { code: draft.skuCode, specifications: draft.specifications },
      offer: { currency: 'CNY', amountMinor: draft.amountMinor, ...(draft.compareMinor === undefined ? {} : { compareMinor: draft.compareMinor }) },
      inventory: { available: draft.available },
      publication: { state: 'draft' },
      validation: { status: 'valid', errors: [] },
    }],
  }, null, 2)}\n`;
}

export function downloadCatalogPackageTemplate(): void {
  const content = `${JSON.stringify(template(), null, 2)}\n`;
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'catalog-package-v1.template.json';
  link.click();
  URL.revokeObjectURL(url);
}

async function digest(content: string): Promise<string> {
  const value = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  return [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function template() {
  return {
    schema: CATALOG_PACKAGE_SCHEMA,
    packageId: 'supplier-name-yyyymmdd-001',
    compiledAt: new Date(0).toISOString(),
    source: { name: '供应商名称', file: '原始文件.xlsx', dataSource: 'supplier' },
    validation: { status: 'passed', errors: [] },
    items: [{
      source: { row: 2, productRef: 'SUPPLIER-SPU-001', skuRef: 'SUPPLIER-SKU-001' },
      product: {
        title: '商品标题', description: '商品描述', category: 'personal', type: 'physical',
        attributes: { subtitle: '商品副标题', brand: '品牌', unit: '件' },
        media: [{ kind: 'image', url: 'https://cdn.example.com/product.jpg' }],
      },
      sku: { code: 'SKU-001', specifications: { 规格: '标准' } },
      offer: { currency: 'CNY', amountMinor: 9900, compareMinor: 12900 },
      inventory: { available: 100 },
      publication: { state: 'draft' },
      validation: { status: 'valid', errors: [] },
    }],
  };
}
