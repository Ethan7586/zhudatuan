import { test } from '@playwright/test';
import { runConsoleJourney } from './JourneyRuntime';

test('product create edit archive', async ({ page }) => runConsoleJourney(page, {
  scenario: 'product create edit archive', path: '/products', assertions: ['创建', '编辑', '版本冲突', '归档影响'],
  operations: ['catalog.product.detail.read', 'catalog.products.create', 'catalog.products.update', 'catalog.products.archive'],
}));

test('product import', async ({ page }) => runConsoleJourney(page, {
  scenario: 'product import', path: '/products', assertions: ['模板', '恶意文件', '预检', '分片', '错误文件'],
  operations: ['runtime.uploads.create', 'catalog.imports.create', 'catalog.imports.read'],
}));

test('stock import', async ({ page }) => runConsoleJourney(page, {
  scenario: 'stock import', path: '/products', assertions: ['水位', '重复批次', '账本', '可用量'],
  operations: ['runtime.uploads.create', 'inventory.imports.create', 'inventory.imports.read', 'inventory.availability.read'],
}));

test('qualification', async ({ page }) => runConsoleJourney(page, {
  scenario: 'qualification', path: '/settings/partners/qualifications', assertions: ['登记', '发布', '到期', '撤销', '自动阻断'],
  operations: ['qualification.center.read', 'qualification.decisions.preview', 'qualification.qualifications.publish', 'qualification.qualifications.revoke'],
}));

test('pricing', async ({ page }) => runConsoleJourney(page, {
  scenario: 'pricing', path: '/products', assertions: ['规则', 'Offer', '舍入', '时段', '叠加'],
  operations: ['pricing.rules.create', 'pricing.rules.publish', 'pricing.offers.read'],
}));

test('pool publication', async ({ page }) => runConsoleJourney(page, {
  scenario: 'pool publication', path: '/products', assertions: ['投池', '批量上下架', '缺依赖', '部分失败'],
  operations: ['catalog.pools.read', 'catalog.pools.attach', 'catalog.listings.publish', 'catalog.listings.batch'],
}));
