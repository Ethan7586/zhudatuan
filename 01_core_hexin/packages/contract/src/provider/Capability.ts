export const PROVIDER_CAPABILITIES = [
  'Catalog',
  'Price',
  'Inventory',
  'GeoStock',
  'GeoStore',
  'GeoDelivery',
  'TimeSlot',
  'Order',
  'Cancel',
  'Return',
  'Refund',
  'Shipment',
  'Logistics',
  'Delivery',
  'Substitute',
  'Issue',
  'DirectCharge',
  'Query',
  'Bind',
  'Verify',
  'Void',
  'Extend',
  'Cinema',
  'Show',
  'SeatLock',
  'Brand',
  'Store',
  'Menu',
  'Option',
  'Pickup',
  'Statement',
  'Webhook',
] as const;

export type ProviderCapability = (typeof PROVIDER_CAPABILITIES)[number];

export function isProviderCapability(value: string): value is ProviderCapability {
  return (PROVIDER_CAPABILITIES as readonly string[]).includes(value);
}
