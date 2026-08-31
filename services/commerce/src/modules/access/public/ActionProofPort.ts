import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { OperationCatalog, type OperationId } from '@shop/contract';
import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { DomainError } from '../../../foundation/domain/DomainError';
import type { AuthorizationPort, AuthorizationSnapshot } from './AuthorizationPort';

export interface ActionProofBinding {
  readonly operation: OperationId;
  readonly resource: string;
  readonly requestHash: string;
  readonly expectedVersion: number | null;
  readonly makerMembership: string;
}

export interface ActionProofChecker {
  readonly membership: string;
  readonly target: 'console' | 'storefront';
  readonly accessVersion: number;
}

export interface AuthorizedActionProof {
  readonly binding: ActionProofBinding;
  readonly checker: ActionProofChecker;
  readonly scope: string;
}

export interface ActionProofPort {
  validate(database: OperationDatabase, binding: ActionProofBinding, checker: ActionProofChecker): Promise<AuthorizedActionProof>;
  issue(database: OperationDatabase, binding: ActionProofBinding, checker: ActionProofChecker): Promise<Readonly<{ proof: string; expiresAt: string }>>;
}

export const ACTION_PROOF_PORT = publicPort<ActionProofPort>('access', 'actionproof');

export class PgActionProofPort implements ActionProofPort {
  constructor(private readonly authorizations: AuthorizationPort) {}

  async validate(database: OperationDatabase, binding: ActionProofBinding, checker: ActionProofChecker): Promise<AuthorizedActionProof> {
    const operation = actionOperation(binding.operation);
    if (binding.makerMembership === checker.membership) throw new DomainError('MAKER_CHECKER_SEPARATION_REQUIRED');
    if (!/^[a-f0-9]{64}$/.test(binding.requestHash)) throw new DomainError('ACTION_PROOF_INVALID');
    if (operation.expectedVersion === 'required' && binding.expectedVersion === null) throw new DomainError('ACTION_PROOF_INVALID');
    const [snapshot, maker] = await Promise.all([
      this.authorizations.read(database, { membership: checker.membership, target: checker.target, operation: operation.id, resource: binding.resource }),
      this.authorizations.read(database, { membership: binding.makerMembership, target: checker.target, operation: operation.id, resource: binding.resource }),
    ]);
    if (
      !authorized(snapshot, checker.membership, operation.id, operation.permission) ||
      snapshot.accessVersion !== checker.accessVersion ||
      !authorized(maker, binding.makerMembership, operation.id, operation.permission) ||
      maker.resource.id !== snapshot.resource.id
    ) {
      throw new DomainError('ACTION_PROOF_INVALID');
    }
    return Object.freeze({ binding, checker, scope: snapshot.resource.id });
  }

  async issue(database: OperationDatabase, binding: ActionProofBinding, checker: ActionProofChecker): Promise<Readonly<{ proof: string; expiresAt: string }>> {
    const approval = await this.validate(database, binding, checker);
    const operation = actionOperation(binding.operation);
    const proof = randomBytes(32).toString('base64url');
    const result = await database.query<{ expires_at: Date | string }>('select expires_at from access.issue_action_proof($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [
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
  return operation as typeof operation & Readonly<{ permission: string }>;
}
