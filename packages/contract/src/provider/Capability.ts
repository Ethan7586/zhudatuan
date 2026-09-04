import type { ProviderPorts } from './Ports';

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

export const PROVIDER_PORT_BY_CAPABILITY = Object.freeze({
  Catalog: 'catalog',
  Brand: 'catalog',
  Store: 'catalog',
  Menu: 'catalog',
  Option: 'catalog',
  Cinema: 'catalog',
  Show: 'catalog',
  GeoStore: 'catalog',
  Price: 'price',
  Inventory: 'stock',
  GeoStock: 'stock',
  TimeSlot: 'stock',
  GeoDelivery: 'stock',
  Order: 'order',
  Issue: 'order',
  DirectCharge: 'order',
  SeatLock: 'order',
  Cancel: 'cancel',
  Void: 'cancel',
  Return: 'return',
  Refund: 'refund',
  Extend: 'refund',
  Substitute: 'refund',
  Logistics: 'tracking',
  Delivery: 'tracking',
  Shipment: 'tracking',
  Pickup: 'tracking',
  Query: 'tracking',
  Statement: 'statement',
  Verify: 'verification',
  Bind: 'verification',
  Webhook: 'webhook',
} as const satisfies Readonly<Record<ProviderCapability, keyof ProviderPorts>>);

export type ProviderPortForCapability<C extends ProviderCapability> = ProviderPorts[(typeof PROVIDER_PORT_BY_CAPABILITY)[C]];

export function isProviderCapability(value: string): value is ProviderCapability {
  return (PROVIDER_CAPABILITIES as readonly string[]).includes(value);
}
