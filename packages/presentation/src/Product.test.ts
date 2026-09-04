import { OP_CATALOG_LISTINGS_PUBLISH, OP_CATALOG_PRODUCTS_UPDATE } from '@shop/contract/ids';
import { describe, expect, it } from 'vitest';
import { PRODUCT_STATUS_OPTIONS, PRODUCT_TYPE_OPTIONS, editableProductStatus, presentCatalogGap, presentProductAction, presentProductBatchAction, presentProductSource, presentProductStatus } from './Product';
import { isActiveProductImport, presentProductImportFailure, presentProductImportField, presentProductImportIssue, presentProductImportState } from './ProductImport';

describe('product presentation', () => {
  it('maps contract statuses and actions to one novice-facing vocabulary', () => {
    expect(presentProductStatus('published')).toMatchObject({ label: '已上架', tone: 'success' });
    expect(presentProductStatus('future')).toMatchObject({ label: '其他状态', tone: 'neutral' });
    expect(presentProductAction(OP_CATALOG_PRODUCTS_UPDATE).submit).toBe('保存修改');
    expect(presentProductAction(OP_CATALOG_LISTINGS_PUBLISH).verb).toBe('上架');
    expect(presentProductBatchAction('unpublish')).toBe('下架');
    expect(PRODUCT_STATUS_OPTIONS.map(({ value }) => value)).toEqual(['draft', 'review', 'active', 'archived']);
    expect(PRODUCT_TYPE_OPTIONS.map(({ value }) => value)).toEqual(['physical', 'virtual', 'service', 'voucher']);
  });

  it('does not expose unknown gaps, providers or missing status values', () => {
    expect(presentCatalogGap('VERSION_CONFLICT')).toBe('商品版本已变化，请重新预检');
    expect(presentCatalogGap('PRIVATE_SERVER_REASON')).toBe('服务端未能处理该商品');
    expect(presentProductSource('partner', 'partner:one')).toMatch(/^供应商 \d{4} \d{4}$/);
    expect(presentProductSource('provider', null)).toBe('外部渠道商品');
    expect(editableProductStatus(undefined)).toBe('draft');
  });

  it('presents every import state and hides raw row failures', () => {
    expect(presentProductImportState('completed').title).toBe('商品导入已完成');
    expect(isActiveProductImport('validating')).toBe(true);
    expect(isActiveProductImport('failed')).toBe(false);
    expect(presentProductImportIssue('CATALOG_CATEGORY_UNKNOWN')).toBe('找不到对应类目');
    expect(presentProductImportIssue('PRIVATE_SQL_FAILURE')).toBe('该行未通过商品校验');
    expect(presentProductImportField('supplier')).toBe('供应商');
    expect(presentProductImportFailure('relation catalog.product does not exist')).not.toContain('catalog.product');
  });
});
