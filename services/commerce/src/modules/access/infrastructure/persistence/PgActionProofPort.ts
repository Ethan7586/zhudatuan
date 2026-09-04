import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { OperationCatalog, type OperationId } from '@shop/contract';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { AuthorizationPort, AuthorizationSnapshot } from '../../public/AuthorizationPort';
import type { ActionProofBinding, ActionProofChecker, AuthorizedActionProof, ActionProofPort } from '../../public/ActionProofPort';
export class PgActionProofPort implements ActionProofPort {
  private readonly transactions = new PgTransactionAccess();
  constructor(private readonly authorizations: AuthorizationPort) {}
  async validate(context: ReadTransactionContext, binding: ActionProofBinding, checker: ActionProofChecker): Promise<AuthorizedActionProof> {
    const database = this.transactions.database(context);
    const operation = actionOperation(binding.operation);
    if (binding.makerMembership === checker.membership) throw new DomainError('MAKER_CHECKER_SEPARATION_REQUIRED');
    if (!/^[a-f0-9]{64}$/.test(binding.requestHash)) throw new DomainError('ACTION_PROOF_INVALID');
    if (operation.expectedVersion === 'required' && binding.expectedVersion === null) throw new DomainError('ACTION_PROOF_INVALID');
    const [snapshot, maker] = await Promise.all([
      this.authorizations.read(context, { membership: checker.membership, target: checker.target, operation: operation.id, resource: binding.resource }),
      this.authorizations.read(context, { membership: binding.makerMembership, target: checker.target, operation: operation.id, resource: binding.resource }),
    ]);
    if (
      !authorized(snapshot, checker.membership, operation.id, operation.permission) ||
      snapshot.accessVersion !== checker.accessVersion ||
      !authorized(maker, binding.makerMembership, operation.id, operation.permission) ||
      maker.resource.id !== snapshot.resource.id
    ) {
      throw new DomainError('ACTION_PROOF_INVALID');
    }
    const separation = await database.query<{ readonly independent: boolean }>(
      'select access.memberships_independent($1,$2) independent', [binding.makerMembership, checker.membership]
    );
    if (separation.rows[0]?.independent !== true) throw new DomainError('MAKER_CHECKER_SEPARATION_REQUIRED');
    return Object.freeze({ binding, checker, scope: snapshot.resource.id });
  }
  async issue(
    context: WriteTransactionContext,
    binding: ActionProofBinding,
    checker: ActionProofChecker
  ): Promise<
    Readonly<{
      proof: string;
      expiresAt: string;
    }>
  > {
    const database = this.transactions.database(context);
    const approval = await this.validate(context, binding, checker);
    const operation = actionOperation(binding.operation);
    const proof = randomBytes(32).toString('base64url');
    const result = await database.query<{
      expires_at: Date | string;
    }>('select expires_at from access.issue_action_proof($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [
      randomUUID(),
      createHash('sha256').update(proof).digest(),
      operation.id,
      binding.resource,
      binding.requestHash,
      binding.expectedVersion,
      checker.target,
      approval.scope,
      binding.makerMembership,
      checker.membership,
      operation.permission,
    ]);
    const expires = result.rows[0]?.expires_at;
    if (!expires) throw new DomainError('ACTION_PROOF_INVALID');
    return Object.freeze({ proof, expiresAt: expires instanceof Date ? expires.toISOString() : new Date(expires).toISOString() });
  }
}
function authorized(snapshot: AuthorizationSnapshot | null, membership: string, operation: string, permission: string): snapshot is AuthorizationSnapshot {
  return Boolean(
    snapshot?.active &&
      snapshot.membership === membership &&
      !snapshot.denies.includes(permission) &&
      snapshot.allows.includes(permission) &&
      snapshot.operations.includes(operation) &&
      typeof snapshot.resource.id === 'string' &&
      snapshot.resource.id.length > 0
  );
}
function actionOperation(id: OperationId) {
  const operation = OperationCatalog.get(id);
  if (!operation.makerChecker || operation.permission === null) throw new DomainError('ACTION_PROOF_INVALID');
  return operation as typeof operation &
    Readonly<{
      permission: string;
    }>;
}
