import type { OperationId } from './OperationCatalog';

export interface OperationFingerprint {
  readonly operation: OperationId;
  readonly input: unknown;
  readonly expectedVersion: number | null;
}

export function operationFingerprint(operation: OperationId, input: unknown, expectedVersion?: number): OperationFingerprint {
  return Object.freeze({ operation, input, expectedVersion: expectedVersion ?? null });
}
