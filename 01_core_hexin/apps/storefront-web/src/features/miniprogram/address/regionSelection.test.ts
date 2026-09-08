import { beforeAll, describe, expect, it } from 'vitest';
import { loadChinaRegions, type ChinaRegionTree } from './chinaRegions';
import { resolveRegionSelection, selectCity, selectProvince } from './regionSelection';

let regions: ChinaRegionTree;

beforeAll(async () => {
  regions = await loadChinaRegions();
});

describe('three-level region selection', () => {
  it('links province, city and district with valid defaults', () => {
    const hubeiIndex = regions.findIndex((region) => region.name === '湖北省');
    const hubei = selectProvince(regions, hubeiIndex);
    expect(hubei).toMatchObject({ province: '湖北省', city: '武汉市' });

    const xiangyangIndex = hubei?.provinceOption.cities.findIndex((city) => city.name === '襄阳市') ?? -1;
    const xiangyang = selectCity(regions, hubei!, xiangyangIndex);
    expect(xiangyang).toMatchObject({ province: '湖北省', city: '襄阳市' });
    expect(xiangyang?.district).toBeTruthy();
  });

  it('resolves municipalities as a complete three-level value', () => {
    expect(resolveRegionSelection(regions, { province: '重庆市', city: '重庆市', district: '渝中区' })).toMatchObject({
      province: '重庆市',
      city: '重庆市',
      district: '渝中区',
    });
  });

  it('keeps the original value untouched until a draft is confirmed', () => {
    const original = { province: '浙江省', city: '杭州市', district: '西湖区' };
    const beijing = selectProvince(regions, 0);
    expect(original).toEqual({ province: '浙江省', city: '杭州市', district: '西湖区' });
    expect(beijing).toMatchObject({ province: '北京市', city: '北京市' });
  });
});
