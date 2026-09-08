import { describe, expect, it, vi } from 'vitest';
import type { DeliveryAddress } from '../types';
import { switchDefaultAddressOptimistically } from './addressDefaultState';

const addresses: DeliveryAddress[] = [
  { id: 'address:one', name: '张三', phone: '13800000000', province: '湖北省', city: '武汉市', district: '武昌区', detail: '一号', isDefault: true, version: 2 },
  { id: 'address:two', name: '李四', phone: '13900000000', province: '浙江省', city: '杭州市', district: '西湖区', detail: '二号', isDefault: false, version: 4 },
];

describe('default address optimistic state', () => {
  it('moves a persisted default to the first position and keeps exactly one default', async () => {
    const publish = vi.fn();
    const result = await switchDefaultAddressOptimistically(addresses, 'address:two', async () => ({
      id: 'address:two', isDefault: true, version: 5,
    }), publish);

    expect(result.map((address) => [address.id, address.isDefault])).toEqual([
      ['address:two', true],
      ['address:one', false],
    ]);
    expect(result[0]?.version).toBe(5);
    expect(publish).toHaveBeenCalledTimes(2);
  });

  it('restores the original state when persistence fails', async () => {
    const snapshots: DeliveryAddress[][] = [];
    await expect(switchDefaultAddressOptimistically(addresses, 'address:two', async () => {
      throw new Error('network');
    }, (value) => snapshots.push(value))).rejects.toThrow('network');

    expect(snapshots).toHaveLength(2);
    expect(snapshots[0]?.[0]?.id).toBe('address:two');
    expect(snapshots[1]).toEqual(addresses);
  });
});
