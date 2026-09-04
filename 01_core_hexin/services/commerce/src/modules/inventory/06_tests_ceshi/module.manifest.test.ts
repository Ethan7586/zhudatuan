import { describe, expect, it } from 'vitest';
import { INVENTORY_CAPABILITIES, inventoryManifest } from '..';

describe('inventory module manifest', () => {
  it('keeps the stable inventory identity and lightweight public entry', () => {
    expect(inventoryManifest.id).toBe('inventory');
    expect(inventoryManifest.publicEntry).toBe('./index.ts');
    expect(inventoryManifest.provides).toEqual([INVENTORY_CAPABILITIES.read, INVENTORY_CAPABILITIES.manage]);
  });

  it('declares inventory dependencies, layers, and entrypoints', () => {
    expect(inventoryManifest.requires).toEqual(['catalog']);
    expect(inventoryManifest.layers).toEqual(['public', 'domain', 'application', 'adapters', 'interface', 'tests']);
    expect(inventoryManifest.entrypoints.http).toEqual(['inventoryOperations']);
    expect(inventoryManifest.entrypoints.jobs).toEqual(['inventoryimport', 'inventorysync']);
  });

  it('declares the inventory operation inventory', () => {
    expect(inventoryManifest.operations).toEqual([
      'inventory.availability.read',
      'inventory.imports.create',
      'inventory.imports.read',
    ]);
  });

  it('declares inventory event ownership', () => {
    expect(inventoryManifest.publishes).toEqual([]);
    expect(inventoryManifest.consumes).toEqual([]);
  });
});
