import assert from 'node:assert/strict';
import test from 'node:test';
import { compileMockpoolCatalog } from './compile-mockpool-catalog.mjs';

test('compiles a 100-row mockpool source into a deterministic draft catalog package', () => {
  const source = {
    meta: { name: '模拟综合货盘', generatedAt: '2026-09-07T00:00:00.000Z' },
    items: Array.from({ length: 100 }, (_, index) => ({
      spuCode: `MOCKPOOL-SPU-${index}`,
      skuCode: `MOCKPOOL-SKU-${index}`,
      name: `测试商品 ${index}`,
      subtitle: '个护清洁 / 口腔护理',
      brand: '测试品牌',
      productType: 'physical',
      unit: '件',
      priceCents: 100 + index,
      marketPriceCents: 200 + index,
      availableStock: index >= 7 && index < 16 ? 0 : 10,
      status: index < 7 ? 'inactive' : 'active',
      taxonomy: { l1: 'personalcare' },
      specifications: { 规格: '标准款' },
      detail: { 描述: `测试商品 ${index}，模拟数据。` },
      coverUrl: `https://picsum.photos/seed/${index}/800/800`,
    })),
  };
  const { document, preview } = compileMockpoolCatalog(source, { inputSha256: 'a'.repeat(64) });
  assert.equal(document.schema, 'catalog-package/v1');
  assert.equal(document.items.length, 100);
  assert.equal(preview.validCount, 100);
  assert.equal(preview.errorCount, 0);
  assert.equal(preview.publishableCount, 84);
  assert.equal(preview.imageCount, 100);
  assert.equal(preview.imageAssetCount, 1);
  assert.ok(document.items.every((item) => item.publication.state === 'draft'));
  assert.ok(document.items.every((item) => item.product.media[0].url.includes('hbbtzn.com')));
  assert.ok(document.items.every((item) => !item.product.media[0].url.includes('picsum.photos')));
  assert.equal(document.items.find((item) => item.source.skuRef === 'MOCKPOOL-SKU-1').product.category, 'personal');
});
