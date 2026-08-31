import { createHash } from 'node:crypto';
import type { OperationRequest } from './OperationExecution';

export function operationRequestHash(request: OperationRequest): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        type: request.type,
        path: request.input.path,
        query: request.input.query,
        body: request.input.body,
        expectedVersion: request.input.expectedVersion ?? null,
      })
    )
    .digest('hex');
}
