import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { CakeProvider } from '../Provider';
<<<<<<< HEAD
<<<<<<< HEAD
import { definition, manifest } from '../manifest';
=======
import { manifest } from '../manifest';
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import { definition, manifest } from '../manifest';
>>>>>>> 018b2a71 (chore(release): capture current production source)

describe('cake provider contract', () => {
  it('is an explicit P1 provider with a release-injected signature', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('cake');
    expect(CakeProvider.definition.id).toBe('cake');
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
    expect(CakeProvider.definition.version).toBe('1.1.0');
    expect(CakeProvider.definition.contractVersion).toBe('cake.v2');
    expect(CakeProvider.definition.capabilities).toEqual(['Catalog', 'Price', 'Inventory']);
    expect(CakeProvider.definition.secretRefs).toEqual(['channelNo', 'channelKey']);
    expect(manifest('signed').signature).toBe('signed');
    expect(() => manifest('')).toThrow('CAKE_MANIFEST_SIGNATURE_MISSING');
  });

  it('installs only the three read ports', () => {
    const provider = CakeProvider.create({
      manifest: manifest('signed'),
      connection: {
        id: 'cake-test',
        baseUrl: 'https://cake.test',
        secret: { channelNo: 'channel', channelKey: 'key' },
        endpoints: {
          'cake.categories': '/channelapi/product/get_cats_list',
          'cake.category.1': '/channelapi/product/get_products_list',
        },
        limits: definition.limits,
        healthOperation: definition.healthOperation,
      },
    });
    expect(provider.has('catalog')).toBe(true);
    expect(provider.has('price')).toBe(true);
    expect(provider.has('stock')).toBe(true);
    expect(provider.has('order')).toBe(false);
    expect(provider.has('tracking')).toBe(false);
    expect(provider.has('webhook')).toBe(false);
  });

  it('fails closed unless exactly one root category endpoint is configured', () => {
    const connection = {
      id: 'cake-test', baseUrl: 'https://cake.test', secret: { channelNo: 'channel', channelKey: 'key' },
      endpoints: { 'cake.categories': '/channelapi/product/get_cats_list' }, limits: definition.limits,
      healthOperation: definition.healthOperation,
    } as const;
    expect(() => CakeProvider.create({ manifest: manifest('signed'), connection })).toThrow('CAKE_ROOT_CATEGORY_CONFIGURATION_INVALID');
  });
<<<<<<< HEAD
=======
    expect(manifest('signed').signature).toBe('signed');
    expect(() => manifest('')).toThrow('CAKE_MANIFEST_SIGNATURE_MISSING');
  });
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
});
