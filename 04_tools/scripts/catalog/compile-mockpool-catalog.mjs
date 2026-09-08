import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CATEGORY_MAP = Object.freeze({
  apparel: 'apparel',
  appliance: 'appliance',
  beauty: 'personal_beauty',
  books: 'welfare_review_unclassified',
  digital: 'digital',
  food: 'food',
  fresh: 'welfare_review_unclassified',
  home: 'home',
  liquor: 'food',
  mombaby: 'supermarket_family',
  personalcare: 'personal',
  sports: 'supermarket_outdoor_sports',
  voucher: 'service_virtual_card',
  welfare: 'welfare',
});

export function compileMockpoolCatalog(source, options = {}) {
  if (source === null || typeof source !== 'object' || Array.isArray(source) || !Array.isArray(source.items)) {
    throw new Error('MOCKPOOL_SOURCE_INVALID');
  }
  const inputSha256 = options.inputSha256 ?? digest(JSON.stringify(source));
  const sourceFile = options.sourceFile ?? '货盘-源数据.json';
  const imageUrl = options.imageUrl ?? 'https://hbbtzn.com/catalog-media/mockpool-test-product.svg';
  const errors = [];
  const seen = new Set();
  const items = source.items.map((item, index) => {
    const row = index + 1;
    const rowErrors = validate(item, row, seen);
    const category = CATEGORY_MAP[item?.taxonomy?.l1];
    if (!category) rowErrors.push(error(row, 'MOCKPOOL_CATEGORY_UNMAPPED', 'taxonomy.l1', String(item?.taxonomy?.l1 ?? '')));
    errors.push(...rowErrors);
    return {
      source: { row, productRef: String(item?.spuCode ?? ''), skuRef: String(item?.skuCode ?? '') },
      product: {
        title: String(item?.name ?? ''),
        description: String(item?.detail?.['描述'] ?? `${item?.name ?? ''}｜模拟综合货盘测试数据，非真实商品。`),
        category: category ?? 'welfare_review_unclassified',
        type: item?.productType === 'virtual' ? 'virtual' : 'physical',
        attributes: {
          subtitle: String(item?.subtitle ?? ''),
          brand: String(item?.brand ?? ''),
          unit: String(item?.unit ?? ''),
          isTest: true,
          dataSource: 'simulated',
          sourceStatus: String(item?.status ?? ''),
          sourceTaxonomy: item?.taxonomy ?? {},
          sourceDetail: item?.detail ?? {},
          originalCoverUrl: String(item?.coverUrl ?? ''),
        },
        media: [{ kind: 'image', url: imageUrl }],
      },
      sku: { code: String(item?.skuCode ?? ''), specifications: item?.specifications ?? {} },
      offer: {
        currency: 'CNY',
        amountMinor: item?.priceCents,
        compareMinor: item?.marketPriceCents,
      },
      inventory: { available: item?.availableStock },
      publication: { state: 'draft' },
      validation: { status: rowErrors.length === 0 ? 'valid' : 'invalid', errors: rowErrors },
    };
  });
  const packageId = options.packageId ?? `mockpool-l1-${inputSha256.slice(0, 16)}`;
  const compiledAt = typeof source.meta?.generatedAt === 'string' ? source.meta.generatedAt : '2026-09-07T00:00:00.000Z';
  const document = {
    schema: 'catalog-package/v1',
    packageId,
    compiledAt,
    source: {
      name: String(source.meta?.name ?? '模拟综合货盘'),
      file: sourceFile,
      dataSource: 'simulated',
      isMock: true,
      inputSha256,
      compiler: 'mockpool-to-catalog-package/v1',
    },
    validation: { status: errors.length === 0 ? 'passed' : 'partial', errors },
    items,
  };
  const active = source.items.filter((item) => item?.status === 'active').length;
  const zeroStock = source.items.filter((item) => item?.availableStock === 0).length;
  const publishable = source.items.filter((item) => item?.status === 'active' && Number(item?.availableStock) > 0).length;
  return {
    document,
    preview: {
      schema: document.schema,
      packageId,
      inputSha256,
      itemCount: items.length,
      validCount: items.filter((item) => item.validation.status === 'valid').length,
      errorCount: errors.length,
      activeCount: active,
      inactiveCount: items.length - active,
      zeroStockCount: zeroStock,
      publishableCount: publishable,
      imageCount: items.filter((item) => item.product.media.length > 0).length,
      imageAssetCount: new Set(items.flatMap((item) => item.product.media.map(({ url }) => url))).size,
      minimumPriceMinor: Math.min(...source.items.map((item) => Number(item?.priceCents))),
      maximumPriceMinor: Math.max(...source.items.map((item) => Number(item?.priceCents))),
      categoryCounts: Object.fromEntries(Object.keys(CATEGORY_MAP).sort().map((key) => [key,
        source.items.filter((item) => item?.taxonomy?.l1 === key).length])),
      canonicalCategoryMap: CATEGORY_MAP,
    },
  };
}

function validate(item, row, seen) {
  const errors = [];
  if (item === null || typeof item !== 'object' || Array.isArray(item)) return [error(row, 'MOCKPOOL_ITEM_INVALID', 'item', '')];
  for (const key of ['spuCode', 'skuCode', 'name']) {
    if (typeof item[key] !== 'string' || !item[key].trim()) errors.push(error(row, 'MOCKPOOL_FIELD_REQUIRED', key, ''));
  }
  if (seen.has(item.skuCode)) errors.push(error(row, 'MOCKPOOL_SKU_DUPLICATE', 'skuCode', String(item.skuCode ?? '')));
  seen.add(item.skuCode);
  for (const key of ['priceCents', 'marketPriceCents', 'availableStock']) {
    if (!Number.isSafeInteger(item[key]) || item[key] < 0) errors.push(error(row, 'MOCKPOOL_NUMBER_INVALID', key, String(item[key] ?? '')));
  }
  if (Number.isSafeInteger(item.marketPriceCents) && Number.isSafeInteger(item.priceCents)
    && item.marketPriceCents < item.priceCents) errors.push(error(row, 'MOCKPOOL_COMPARE_PRICE_INVALID', 'marketPriceCents', String(item.marketPriceCents)));
  if (!['active', 'inactive'].includes(item.status)) errors.push(error(row, 'MOCKPOOL_STATUS_INVALID', 'status', String(item.status ?? '')));
  if (!['physical', 'virtual'].includes(item.productType)) errors.push(error(row, 'MOCKPOOL_TYPE_INVALID', 'productType', String(item.productType ?? '')));
  return errors;
}

function error(row, code, field, value) {
  return { row, code, field, value };
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

const entry = process.argv[1] ? resolve(process.argv[1]) : '';
if (entry === fileURLToPath(import.meta.url)) {
  const [input, output, previewOutput, imageUrl] = process.argv.slice(2);
  if (!input || !output || !previewOutput) throw new Error('USAGE: compile-mockpool-catalog.mjs INPUT OUTPUT PREVIEW [IMAGE_URL]');
  const bytes = await readFile(input);
  const source = JSON.parse(bytes.toString('utf8'));
  const compiled = compileMockpoolCatalog(source, {
    inputSha256: digest(bytes),
    sourceFile: basename(input),
    ...(imageUrl ? { imageUrl } : {}),
  });
  const serialized = `${JSON.stringify(compiled.document, null, 2)}\n`;
  const preview = { ...compiled.preview, packageSha256: digest(serialized) };
  await writeFile(output, serialized);
  await writeFile(previewOutput, `${JSON.stringify(preview, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(preview)}\n`);
}
