import { COMMERCE_EVENTS, OperationCatalog } from '@shop/contract';
import { describe, expect, it } from 'vitest';
import { COMMERCE_MODULES } from '../../generated/ModuleCatalog';
import { JOB_CATALOG } from '../../pipeline/JobCatalog';

describe('module manifest contracts', () => {
  it('declares every module, operation, event and job exactly once from its authoritative catalog', () => {
    const manifests = COMMERCE_MODULES.map(({ manifest }) => manifest);
    expect(manifests).toHaveLength(33);
    expect(unique(manifests.map(({ id }) => id))).toBe(true);
    expect(manifests.flatMap(({ operations }) => operations).sort()).toEqual(
      OperationCatalog.all()
        .map(({ id }) => id)
        .sort()
    );
    expect(manifests.flatMap(({ events }) => events).sort()).toEqual(COMMERCE_EVENTS.map(({ type }) => type).sort());
    expect(manifests.flatMap(({ jobs }) => jobs).sort()).toEqual(JOB_CATALOG.map(({ id }) => id).sort());
  });

  it('declares public ports and closed configuration schemas for every workload', () => {
    for (const { manifest } of COMMERCE_MODULES) {
      const workloadPorts = Object.values(manifest.workloads).flatMap(({ publicPorts }) => publicPorts);
      expect([...new Set(workloadPorts)].sort(), manifest.id).toEqual(manifest.publicPorts);
      expect(
        manifest.publicPorts.every((port) => port.startsWith(`${manifest.id}.`)),
        manifest.id
      ).toBe(true);
      for (const [workload, definition] of Object.entries(manifest.workloads)) {
        expect(definition.configuration, `${manifest.id}:${workload}`).toEqual({
          id: `${manifest.id}.${workload}.configuration`,
          required: [...definition.services].sort(),
          additionalProperties: false,
        });
      }
    }
  });
});

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}
