import { DomainError } from '../domain/DomainError';
import { createHash } from 'node:crypto';
import { OperationCatalog } from '@shop/contract';
import type { OperationDatabase } from '../application/ModuleOperations';
import type { OperationRequest } from '../application/OperationExecution';
import { operationRequestHash } from '../application/OperationHash';
import { requireActionProof, requireSession } from './OperationSecurityContext';

interface ConsumedProof {
  readonly proof_id: string;
  readonly checker_membership_id: string;
}

export class MakerCheckerPolicy {
  async consume(database: OperationDatabase, request: OperationRequest): Promise<void> {
    const operation = OperationCatalog.get(request.type);
    if (!operation.makerChecker) return;
    const permission = operation.permission;
    if (permission === null) throw new DomainError('ACTION_PROOF_INVALID');
    const access = requireSession(request.security);
    const proof = requireActionProof(request.input.headers);
    const resource = Object.values(request.input.path)[0] ?? access.scope.id;
    let result;
    try {
      result = await database.query<ConsumedProof>(
        `select proof_id,checker_membership_id
        from access.consume_action_proof($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [createHash('sha256').update(proof).digest(), operation.id, resource, operationRequestHash(request), request.input.expectedVersion ?? null, access.actor.target, access.scope.id, access.membership.id, permission]
      );
    } catch (cause) {
      const code = proofFailure(cause);
      if (code !== undefined) throw new DomainError(code);
      throw cause;
    }
    if (!result.rows[0]) throw new DomainError('ACTION_PROOF_INVALID');
  }
}

function proofFailure(cause: unknown): 'ACTION_PROOF_INVALID' | 'ACTION_PROOF_REPLAYED' | 'MAKER_CHECKER_SEPARATION_REQUIRED' | undefined {
  if (cause === null || typeof cause !== 'object' || !('message' in cause)) return undefined;
  const message = String(cause.message);
  if (message === 'ACTION_PROOF_INVALID' || message === 'ACTION_PROOF_REPLAYED' || message === 'MAKER_CHECKER_SEPARATION_REQUIRED') return message;
  return undefined;
}
