import { randomUUID } from 'node:crypto';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationExecution';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { requireAccess } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import { AccessVersionService } from '../service/AccessVersionService';
import type { AccessRepository } from '../port/AccessRepository';

export class ManageScope {
  constructor(
    private readonly repository: AccessRepository,
    private readonly versions: AccessVersionService
  ) {}

  async execute(request: OperationRequest, database: OperationDatabase): Promise<OperationResult> {
    const access = requireAccess(request);
    const body = bodyRecord(request);
    const membership = textField(body, 'targetMembership');
    const kind = textField(body, 'kind');
    const scope = textField(body, 'scope');
    const effect = body.effect === 'deny' ? 'deny' : 'allow';
    const path = await this.repository.scopePath(database, scope, kind);
    if (path === null) throw new DomainError('SCOPE_DENIED');
    const changed = await this.repository.grantScope(database, { id: `scope:${randomUUID()}`, membership, kind, scope, path, effect, expiresAt: expiry(body.expiresAt), expectedVersion: request.input.expectedVersion! });
    if (!changed) throw new DomainError('VERSION_CONFLICT');
    const version = await this.versions.bump(database, membership, 'scopegrantchanged', access.trace);
    return { status: 200, body: { id: changed.id, membershipId: changed.membership, kind: changed.kind, scope: changed.resource, effect: changed.effect, expiresAt: changed.expiresAt?.toISOString() ?? null, accessVersion: version } };
  }
}

function expiry(value: unknown): Date | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new DomainError('VALIDATION_FAILED');
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.getTime() <= Date.now()) throw new DomainError('VALIDATION_FAILED');
  return parsed;
}
