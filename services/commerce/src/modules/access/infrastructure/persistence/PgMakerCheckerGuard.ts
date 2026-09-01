import { createHash } from 'node:crypto';
import { OperationCatalog } from '@shop/contract';
import type { MakerCheckerGuard } from '../../../../foundation/application/OperationExecutor';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
interface ConsumedProof extends Record<string, unknown> {
  readonly proof_id: string;
  readonly checker_membership_id: string;
}
export class PgMakerCheckerGuard implements MakerCheckerGuard {
  constructor(private readonly transactions: PgTransactionAccess) {}
  async verify(context: WriteTransactionContext, input: Parameters<MakerCheckerGuard['verify']>[1]): Promise<void> {
    const database = this.transactions.database(context);
    const operation = OperationCatalog.get(input.operation);
    if (!operation.makerChecker) return;
    if (!operation.permission || !input.actionProof) throw new DomainError('ACTION_PROOF_INVALID');
    const access = requireSession(input.execution.security);
    let result;
    try {
      result = await this.transactions.database(context).query<ConsumedProof>(
        `select proof_id,checker_membership_id
        from access.consume_action_proof($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [createHash('sha256').update(input.actionProof).digest(), operation.id, input.resource, input.requestHash, input.expectedVersion ?? null, access.actor.target, access.scope.id, access.membership.id, operation.permission]
      );
    } catch (cause) {
      const code = proofFailure(cause);
      if (code) throw new DomainError(code);
      throw cause;
    }
    if (!result.rows[0]) throw new DomainError('ACTION_PROOF_INVALID');
  }
}
function proofFailure(cause: unknown): 'ACTION_PROOF_INVALID' | 'ACTION_PROOF_REPLAYED' | 'MAKER_CHECKER_SEPARATION_REQUIRED' | undefined {
  if (cause === null || typeof cause !== 'object' || !('message' in cause)) return undefined;
  const message = String(cause.message);
  return ['ACTION_PROOF_INVALID', 'ACTION_PROOF_REPLAYED', 'MAKER_CHECKER_SEPARATION_REQUIRED'].includes(message) ? (message as 'ACTION_PROOF_INVALID' | 'ACTION_PROOF_REPLAYED' | 'MAKER_CHECKER_SEPARATION_REQUIRED') : undefined;
}
