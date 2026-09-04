import { describe, expect, it } from 'vitest';
import { NAVIGATION_BY_KEY, NAVIGATION_CATALOG } from '../infrastructure/registry/NavigationCatalog';
import { NavigationContext } from '../domain/model/NavigationContext';
import { NavigationFilter } from '../application/service/NavigationFilter';

const ORIGINAL_KEYS = Object.freeze([
  'platformcontrol', 'platformcatalog', 'platformvoucher', 'distributioncontrol', 'groupdashboard', 'groupcontrol', 'groupapplication', 'groupproduct', 'grouporder', 'groupreferral', 'groupvoucher', 'groupchannel', 'groupfinance', 'groupreporting', 'groupsupport', 'groupsettings',
  'malldashboard', 'mallcontrol', 'malldesign', 'mallproduct', 'mallorder', 'mallvoucher', 'mallchannel', 'mallfinance', 'mallreferral', 'mallreporting', 'mallsupport', 'mallsettings', 'platformchannel', 'groupadmin', 'groupmemberdata', 'groupinvitation',
  'grouppartner', 'groupqualification', 'groupmessage', 'grouprisk', 'groupprovider', 'groupdirectory', 'malladmin', 'mallmemberdata', 'mallinvitation', 'mallpartner', 'mallqualification', 'mallmessage', 'mallrisk', 'mallprovider', 'malldirectory',
  'storehome', 'storecatalog', 'storeproduct', 'storecart', 'storecheckout', 'storepayment', 'storeorders', 'storeorder', 'storeaftersale', 'storevouchers', 'storebenefits', 'storeprofile', 'storesecurity', 'storesupport', 'storesupportcase', 'storenotifications',
] as const);

describe('generated navigation catalog', () => {
  it('preserves every original 63-node product entry while extending all six surfaces', () => {
    expect(ORIGINAL_KEYS).toHaveLength(63);
    expect(ORIGINAL_KEYS.filter((key) => !NAVIGATION_BY_KEY.has(key))).toEqual([]);
    expect(NAVIGATION_CATALOG).toHaveLength(143);
    expect(new Set(NAVIGATION_CATALOG.map(({ key }) => key)).size).toBe(NAVIGATION_CATALOG.length);
    expect(new Set(NAVIGATION_CATALOG.map(({ surface }) => surface))).toEqual(new Set(['console', 'storefront', 'miniapp', 'store', 'supplier']));
  });

  it('publishes only Chinese labels and Operation-derived visibility policy', () => {
    for (const node of NAVIGATION_CATALOG) {
      expect(node.title).toMatch(/\p{Script=Han}/u);
      expect(node.operation).toMatch(/^[a-z]+(?:\.[a-z]+)+$/);
      expect(node.capability).toMatch(/^[a-z]+(?:\.[a-z]+)+$/);
      expect(node.experience.route).toMatch(/^\//);
      expect(['primary', 'secondary', 'contextual']).toContain(node.experience.placement);
      expect(node).not.toHaveProperty('permissions');
      expect(node).not.toHaveProperty('capabilities');
      expect(node).not.toHaveProperty('requirements');
    }
  });

  it('keeps the four console scopes within the intended primary choice budget', () => {
    const expected = {
      platform: ['platformcontrol', 'platformcatalog', 'platformvoucher', 'platformchannel', 'platformsettings'],
      distributor: ['distributioncontrol', 'distributionreferral', 'distributionchannel', 'distributionsettings'],
      enterprise: ['groupdashboard', 'groupapplication', 'groupproduct', 'grouporder', 'groupvoucher', 'groupfinance', 'groupreporting', 'groupsettings'],
      mall: ['malldashboard', 'malldesign', 'mallproduct', 'mallorder', 'mallvoucher', 'mallfinance', 'mallreporting', 'mallsettings'],
    } as const;
    for (const [scope, keys] of Object.entries(expected)) {
      const primary = NAVIGATION_CATALOG.filter((node) => node.surface === 'console' && node.scope === scope && node.parent === null && node.experience.placement === 'primary').map(({ key }) => key);
      expect(primary.length).toBeLessThanOrEqual(8);
      expect(new Set(primary)).toEqual(new Set(keys));
    }
  });

  it('projects every configured deep link with a reversible breadcrumb and stable sibling order', () => {
    const permissions = new Set(NAVIGATION_CATALOG.flatMap((node) => (node.permission === null ? [] : [node.permission])));
    const capabilities = new Set(NAVIGATION_CATALOG.map(({ capability }) => capability));
    const featureFlags = new Set(NAVIGATION_CATALOG.flatMap(({ featureFlags: flags }) => flags));
    const partitions = new Set(NAVIGATION_CATALOG.map(({ surface, scope }) => `${surface}:${scope}`));
    for (const partition of partitions) {
      const [target, kind] = partition.split(':') as [typeof NAVIGATION_CATALOG[number]['surface'], typeof NAVIGATION_CATALOG[number]['scope']];
      const scope = { membership: 'membership:one', id: `${kind}:one`, kind, status: 'active' as const, version: 1, default: true };
      const source = NAVIGATION_CATALOG.filter((node) => node.surface === target && node.scope === kind);
      const nodes = new NavigationFilter().apply(source, new NavigationContext({ target, principal: 'principal:one', membership: 'membership:one', membershipActive: true, assurance: 2, scope, scopes: [scope], permissions, capabilities, featureFlags, accessVersion: 1, capabilityVersion: 1 }));
      const projected = flatten(nodes);
      expect(new Set(projected.map(({ key }) => key))).toEqual(new Set(source.map(({ key }) => key)));
      for (const node of projected) {
        expect(node.experience.breadcrumbs.at(-1)).toEqual({ key: node.key, title: node.title });
        expect(node.children.map(({ key }) => key)).toEqual([...node.children].sort((left, right) => left.order - right.order || left.key.localeCompare(right.key)).map(({ key }) => key));
      }
    }
  });
});

function flatten<T extends Readonly<{ children: readonly T[] }>>(nodes: readonly T[]): readonly T[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}
