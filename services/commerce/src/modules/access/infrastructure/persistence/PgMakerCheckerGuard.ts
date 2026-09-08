import { createHash } from 'node:crypto';
import { OperationCatalog } from '@shop/contract';
import type { MakerCheckerGuard } from '../../../../pipeline/OperationExecutor';
import { DomainError } from '../../../../platform/error/DomainError';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { SeparationPolicy } from '../../domain/policy/SeparationPolicy';
interface ConsumedProof extends Record<string, unknown> {
  readonly proof_id: string;
  readonly checker_membership_id: string;
}
export class PgMakerCheckerGuard implements MakerCheckerGuard {
  private readonly separation = new SeparationPolicy();
  constructor(private readonly transactions: PgTransactionAccess) {}
  async verify(context: WriteTransactionContext, input: Parameters<MakerCheckerGuard['verify']>[1]): Promise<void> {
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
    const consumed = result.rows[0];
    if (!consumed) throw new DomainError('ACTION_PROOF_INVALID');
    this.separation.assertActors(access.membership.id, consumed.checker_membership_id);
  }
}
function proofFailure(cause: unknown): 'ACTION_PROOF_INVALID' | 'ACTION_PROOF_REPLAYED' | 'MAKER_CHECKER_SEPARATION_REQUIRED' | undefined {
  if (cause === null || typeof cause !== 'object' || !('message' in cause)) return undefined;
  const message = String(cause.message);
  return ['ACTION_PROOF_INVALID', 'ACTION_PROOF_REPLAYED', 'MAKER_CHECKER_SEPARATION_REQUIRED'].includes(message) ? (message as 'ACTION_PROOF_INVALID' | 'ACTION_PROOF_REPLAYED' | 'MAKER_CHECKER_SEPARATION_REQUIRED') : undefined;
}
