import { beforeAll, describe, expect, it } from 'vitest';
import { loadChinaRegions, type ChinaRegionTree } from './chinaRegions';
import { missingAddressFields, parseAddressText } from './addressTextParser';

let regions: ChinaRegionTree;

beforeAll(async () => {
  regions = await loadChinaRegions();
});

describe('address text parser', () => {
  it('recognizes a normal spaced mainland address', () => {
    expect(parseAddressText('张三 13800138000 湖北省武汉市武昌区中北路 88 号 3 栋 1201', regions)).toEqual({
      name: '张三',
      phone: '13800138000',
      province: '湖北省',
      city: '武汉市',
      district: '武昌区',
      detail: '中北路 88 号 3 栋 1201',
    });
  });

  it('accepts newlines, commas and a phone with separators', () => {
    expect(parseAddressText('收货人：李四\n电话：139-0000-0000，浙江省，杭州市，西湖区，文一路 1 号', regions)).toMatchObject({
      name: '李四',
      phone: '13900000000',
      province: '浙江省',
      city: '杭州市',
      district: '西湖区',
      detail: '文一路 1 号',
    });
  });

  it('handles a municipality without requiring the city name twice', () => {
    expect(parseAddressText('王五 13600000000 北京市朝阳区望京街 8 号', regions)).toMatchObject({
      province: '北京市',
      city: '北京市',
      district: '朝阳区',
      detail: '望京街 8 号',
    });
  });

  it('handles an autonomous region and a continuous Chinese address', () => {
    expect(parseAddressText('阿依古丽18600000000新疆维吾尔自治区乌鲁木齐市天山区青年路18号', regions)).toMatchObject({
      name: '阿依古丽',
      phone: '18600000000',
      province: '新疆维吾尔自治区',
      city: '乌鲁木齐市',
      district: '天山区',
      detail: '青年路18号',
    });
  });

  it('infers the province from city and district while reporting missing fields', () => {
    const result = parseAddressText('赵六 13700000000 武汉市武昌区水果湖街道', regions);
    expect(result).toMatchObject({ province: '湖北省', city: '武汉市', district: '武昌区' });
    expect(missingAddressFields({ ...result, phone: '' })).toContain('手机号');
  });
});
