import { describe, expect, it } from 'vitest';
import { canonicalizeProductBrand, mallShortName } from './productBrand';

describe('product brand presentation', () => {
  it.each([
    ['智慧翼企业福利商城', '主打团企业福利商城'],
    ['Smart Wing 福利平台', 'ZHUDATUAN 福利平台'],
    ['SMART-WING 商城', 'ZHUDATUAN 商城'],
    ['筑大团商城', '主打团商城'],
    ['築大团商城', '主打团商城'],
    ['ZhudaTuan B2B2C', 'ZHUDATUAN B2B2C'],
  ])('canonicalizes retired display copy %s', (source, expected) => {
    expect(canonicalizeProductBrand(source)).toBe(expected);
  });

  it('does not rewrite unrelated business data', () => {
    expect(canonicalizeProductBrand('中国建筑集团福利商城')).toBe('中国建筑集团福利商城');
  });

  it('removes the canonical mall prefix after legacy copy is normalized', () => {
    expect(mallShortName('智慧翼福利商城 - 北京分商城')).toBe('北京分商城');
  });
});
