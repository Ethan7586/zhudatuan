import { createHash } from 'node:crypto';
import { operationFingerprint, type OperationId } from '@shop/contract';

export function executionRequestHash(operation: OperationId, input: unknown, expectedVersion?: number): string {
  return createHash('sha256').update(JSON.stringify(operationFingerprint(operation, input, expectedVersion))).digest('hex');
}
