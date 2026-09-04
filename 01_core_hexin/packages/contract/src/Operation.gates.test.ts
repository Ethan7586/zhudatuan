import { describe, expect, it } from 'vitest';
import {
  OperationCatalog,
  operation,
  type OperationGateDeclaration,
} from './index';

const baseOperation = {
  id: 'test.operation',
  method: 'POST',
  path: '/api/v1/test/operation',
  module: 'test',
  audience: 'operator',
  idempotent: false,
  idempotency: 'required',
  expectedVersion: 'none',
  execution: 'sync',
  availability: 'runtime',
  summary: 'test operation',
  risk: 'low',
  stepup: false,
  scopeKinds: [],
  schema: 'structural',
  requirements: [],
} as const;

const validGate = {
  slot: 'risk',
  phase: 'before',
  mode: 'observe',
} as const satisfies OperationGateDeclaration;

// @ts-expect-error unknown slots are not valid Operation declarations
const invalidSlotType: OperationGateDeclaration = { slot: 'unknown', phase: 'before', mode: 'observe' };
// @ts-expect-error only the before phase is available in this batch
const invalidPhaseType: OperationGateDeclaration = { slot: 'risk', phase: 'after', mode: 'observe' };
// @ts-expect-error enforce is not an available mode
const invalidModeType: OperationGateDeclaration = { slot: 'risk', phase: 'before', mode: 'enforce' };

void invalidSlotType;
void invalidPhaseType;
void invalidModeType;

describe('Operation gates', () => {
  it('keeps existing Operations valid without adding a gates property', () => {
    const legacyDefinition = operation(baseOperation);

    expect(legacyDefinition).not.toHaveProperty('gates');
    expect(OperationCatalog.get('runtime.health.live').gates).toBeUndefined();
  });

  it('accepts and freezes a valid optional declaration', () => {
    const definition = operation({ ...baseOperation, gates: [validGate] });

    expect(definition.gates).toEqual([validGate]);
    expect(Object.isFrozen(definition.gates)).toBe(true);
    expect(Object.isFrozen(definition.gates?.[0])).toBe(true);
  });

  it('rejects an invalid slot', () => {
    expect(() => operation({
      ...baseOperation,
      gates: [{ ...validGate, slot: 'unknown' as OperationGateDeclaration['slot'] }],
    })).toThrow('OPERATION_GATE_SLOT_INVALID');
  });

  it('rejects an invalid phase', () => {
    expect(() => operation({
      ...baseOperation,
      gates: [{ ...validGate, phase: 'after' as OperationGateDeclaration['phase'] }],
    })).toThrow('OPERATION_GATE_PHASE_INVALID');
  });

  it('rejects an invalid mode', () => {
    expect(() => operation({
      ...baseOperation,
      gates: [{ ...validGate, mode: 'enforce' as OperationGateDeclaration['mode'] }],
    })).toThrow('OPERATION_GATE_MODE_INVALID');
  });
});
