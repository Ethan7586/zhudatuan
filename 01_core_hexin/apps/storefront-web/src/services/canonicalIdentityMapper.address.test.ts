import { describe, expect, it } from 'vitest';
import { mapCanonicalAddresses } from './canonicalIdentityMapper';

describe('canonical address mapper', () => {
  it('uses the persisted default flag and sorts the real default first', () => {
    const mapped = mapCanonicalAddresses({ items: [
      { id: 'address:one', recipient_masked: '张*', mobile_masked: '138****0000', address_masked: '一号***', region_code: '湖北省/武汉市/武昌区', is_default: false, version: '3' },
      { id: 'address:two', recipient_masked: '李*', mobile_masked: '139****0000', address_masked: '二号***', region_code: '浙江省/杭州市/西湖区', is_default: true, version: '5' },
    ] });

    expect(mapped.map((address) => [address.id, address.isDefault, address.version])).toEqual([
      ['address:two', true, 5],
      ['address:one', false, 3],
    ]);
  });

  it('does not invent a default when the server returns none', () => {
    expect(mapCanonicalAddresses({ items: [
      { id: 'address:one', region_code: '湖北省/武汉市/武昌区', is_default: false, version: 0 },
    ] })[0]?.isDefault).toBe(false);
  });
});
