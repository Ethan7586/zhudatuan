import type { DeliveryAddress } from '../types';

interface DefaultAddressResult {
  id: string;
  isDefault: boolean;
  version: number;
}

export function markDefaultAddress(addresses: readonly DeliveryAddress[], addressId: string, version?: number): DeliveryAddress[] {
  const target = addresses.find((address) => address.id === addressId);
  if (!target) return [...addresses];
  return [
    { ...target, isDefault: true, ...(version === undefined ? {} : { version }) },
    ...addresses.filter((address) => address.id !== addressId).map((address) => ({ ...address, isDefault: false })),
  ];
}

export async function switchDefaultAddressOptimistically(
  addresses: readonly DeliveryAddress[],
  addressId: string,
  persist: (address: DeliveryAddress) => Promise<DefaultAddressResult>,
  publish: (addresses: DeliveryAddress[]) => void,
): Promise<DeliveryAddress[]> {
  const target = addresses.find((address) => address.id === addressId);
  if (!target) throw new Error('ADDRESS_NOT_FOUND');
  if (target.isDefault) return [...addresses];

  publish(markDefaultAddress(addresses, addressId));
  try {
    const result = await persist(target);
    const committed = markDefaultAddress(addresses, result.id, result.version);
    publish(committed);
    return committed;
  } catch (error) {
    publish([...addresses]);
    throw error;
  }
}
