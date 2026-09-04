export const INVENTORY_CAPABILITIES = Object.freeze({
  read: 'inventory.read',
  manage: 'inventory.manage',
} as const);

export type InventoryCapability = (typeof INVENTORY_CAPABILITIES)[keyof typeof INVENTORY_CAPABILITIES];
