import { describe, expect, it } from 'vitest';
import { operationFingerprint } from './OperationFingerprint';

describe('operationFingerprint', () => {
  it('defines the single canonical request payload used by action proofs and execution', () => {
    const input = Object.freeze({ body: Object.freeze({ targetMembership: 'membership:target', effect: 'allow' }) });

    expect(JSON.stringify(operationFingerprint('access.scopes.manage', input, 3))).toBe(
      '{"operation":"access.scopes.manage","input":{"body":{"targetMembership":"membership:target","effect":"allow"}},"expectedVersion":3}'
    );
    expect(operationFingerprint('access.scopes.manage', input)).toEqual({ operation: 'access.scopes.manage', input, expectedVersion: null });
  });
});
