import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

import {
  ORDER_REQUIREMENT_IDS,
  loadOrderRequirementProfile,
  orderRequirementYaml,
  validateOrderRequirementIds,
  type TraceNode,
} from './OrderRequirementProfile';

const root = resolve(import.meta.dirname, '../../../..');

describe('Smart Wing OMS requirement profile', () => {
  it('defines exactly OMS-001 through OMS-014 once and in fixed order', async () => {
    const profile = await loadOrderRequirementProfile(root);
    const ids = profile.requirements.map(({ id }) => id);

    expect(ids).toEqual(ORDER_REQUIREMENT_IDS);
    expect(new Set(ids).size).toBe(14);
  });

  it('rejects a duplicate OMS ID with a stable validation error', () => {
    const duplicated = [...ORDER_REQUIREMENT_IDS];
    duplicated[13] = 'OMS-013';

    expect(() => validateOrderRequirementIds(duplicated)).toThrow('ORDER_REQUIREMENT_IDS_INVALID:');
  });

  it('maps only registered operations as Existing and only unregistered operations as Planned', async () => {
    const profile = await loadOrderRequirementProfile(root);
    const operationDocument = parse(await readFile(resolve(root, '01_core_hexin/packages/contract/definitions/operations.yml'), 'utf8')) as {
      readonly operations: readonly { readonly id: string }[];
    };
    const registered = new Set(operationDocument.operations.map(({ id }) => id));

    for (const requirement of profile.requirements) {
      expect(requirement.existingOperations.every((id) => registered.has(id))).toBe(true);
      expect(requirement.plannedOperations.every((id) => !registered.has(id))).toBe(true);
    }
  });

  it('keeps Designed and Missing trace nodes free of invented evidence', async () => {
    const profile = await loadOrderRequirementProfile(root);
    for (const requirement of profile.requirements) {
      for (const node of Object.values(requirement.trace).flatMap((value) => Array.isArray(value) ? value : [value])) {
        assertEvidenceConsistency(node);
      }
    }
  });

  it('renders byte-identical YAML on repeated loads', async () => {
    const first = orderRequirementYaml(await loadOrderRequirementProfile(root));
    const second = orderRequirementYaml(await loadOrderRequirementProfile(root));

    expect(second).toBe(first);
  });

  it('keeps the generated Order Trace byte-identical to the current inputs', async () => {
    const generated = await readFile(resolve(root, '05_docs_ziliao/docs_wendang/requirements/order.yml'), 'utf8');
    const expected = orderRequirementYaml(await loadOrderRequirementProfile(root));

    expect(generated).toBe(expected);
  });
});

function assertEvidenceConsistency(node: TraceNode): void {
  expect(node.target.length).toBeGreaterThan(0);
  if (node.status === 'Existing') expect(node.evidence.length).toBeGreaterThan(0);
  else expect(node.evidence).toEqual([]);
}
